"use client";

import { User } from "@supabase/supabase-js";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { aiAssistant } from "@/lib/ai-assistant";
import type { AiAssistantMode, AiChatHistoryTurn } from "@/lib/ai-assistant";
import { createDeltaThrottle } from "@/lib/ai/delta-throttle";
import { CHAT_HISTORY_CAP, CHAT_PAGE_SIZE, hasMoreAfterLoad, nextOlderRange } from "@/lib/chat-pagination";
import { deriveConversationTitle, pickCurrentConversation } from "@/lib/chat-conversations";
import type { Conversation } from "@/types/database";
import { buildStudentContext } from "@/lib/student-agent/contextBuilder";
import { cannedMessagesFor } from "@/lib/ai/canned-messages";
import { getPuterStatus } from "@/lib/puter";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { logger } from "@/lib/logger";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** True while this message is still receiving streamed deltas (spec 011). */
  streaming?: boolean;
}

const CHAT_STORAGE_KEY_PREFIX = "ai_assistant_chat_messages";

interface SupabaseChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// Spec 008: fire-and-forget inserts must never throw into the chat flow, but
// failures are surfaced to the logger (previously the .then() was discarded).
// Spec 049: rows link to their conversation — the ownership FK
// ((conversation_id, user_id) → conversations(id, user_id)) makes a
// cross-user link impossible, so the client only passes the id it owns.
const insertChatRow = (
  userId: string,
  chatMode: string,
  conversationId: string | null,
  row: { role: "user" | "assistant"; content: string },
) => {
  supabase
    .from("ai_chat_messages")
    .insert({ user_id: userId, role: row.role, content: row.content, mode: chatMode, conversation_id: conversationId })
    .then(({ error }) => {
      if (error) logger.warn("ai_chat_messages insert failed", { error });
    });
};

// Spec 049: lazily create the conversation identity for a thread, titled
// from the first user message. Event-driven by construction — called only
// inside sendMessage's persist path, never on mount/restore. Fire-and-forget
// like the row inserts: a failed create logs and leaves the exchange
// unlinked instead of blocking the UI.
const ensureConversation = async (
  userId: string,
  chatMode: string,
  title: string | null,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, mode: chatMode, title })
    .select("id")
    .single();
  if (error) {
    logger.warn("conversations insert failed", { error });
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
};

// Keep each conversation at the newest CHAT_HISTORY_CAP rows (spec 049: the
// cap is per conversation, not per mode): probe the overflow window (rows
// 101–200 newest) and delete it when present.
const pruneChatOverflow = (conversationId: string) => {
  supabase
    .from("ai_chat_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(CHAT_HISTORY_CAP, CHAT_HISTORY_CAP + 99)
    .then(({ data: overflow, error }) => {
      if (error) {
        logger.warn("ai_chat_messages prune probe failed", { error });
        return;
      }
      const ids = ((overflow || []) as { id: string }[]).map((row) => row.id);
      if (ids.length === 0) return;
      supabase
        .from("ai_chat_messages")
        .delete()
        .in("id", ids)
        .then(({ error: deleteError }) => {
          if (deleteError) logger.warn("ai_chat_messages prune delete failed", { error: deleteError });
        });
    });
};

export function useAiChat(user: User | null | undefined, trackEvent: (event: string, properties?: Record<string, unknown>) => void) {
  const locale = useLocale();
  const t = useTranslations("aiAssistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Spec 036 Track A: render-body mirror — sendMessage snapshots history from
  // this ref instead of reading the messages state, which would pin it in the
  // callback's dep array and recreate the handler on every streamed delta.
  // Assigned during render so event handlers always see the last committed list.
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // New: tracks when everything is loaded and ready
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
  // Spec 011: lazy history sync — the newest page renders first; older rows
  // inside the retained window (spec 008 prune cap) load on scroll-to-top.
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadedCountRef = useRef(0);
  const loadingOlderRef = useRef(false);
  // Spec 049: identity of the conversation the transcript is bound to (null
  // until restore picks one or the first send creates one). The ref is the
  // stable read for callbacks; the state mirrors it for consumers (the
  // chat-history side menu marks the active conversation).
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  // In-flight conversation-ensure promise of the current send (spec 049): the
  // user-row insert chains on it and the assistant-row insert joins it, so
  // both rows link deterministically without the send spinner ever waiting
  // on a persistence round-trip.
  const conversationEnsureRef = useRef<Promise<string | null> | null>(null);
  const switchSeqRef = useRef(0);
  const setCurrentConversation = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
  }, []);
  const [mode, setModeState] = useState<AiAssistantMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zane_ai_last_mode");
      if (saved === "cs_assistant" || saved === "student_agent" || saved === "group_rag") {
        return saved as AiAssistantMode;
      }
    }
    return "cs_assistant";
  });
  const storageKey = `${CHAT_STORAGE_KEY_PREFIX}_${mode}`;

  const { academic } = useUserAcademic();
  const [studentSelectedSubject, setStudentSelectedSubject] = useState<string>("");

  // ────────────────────────────────────────────────────────────────────────────
  // GUEST PATH — useLayoutEffect runs synchronously before the browser paints.
  // This prevents the "spinner flash" for guests by initializing state early.
  // ────────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (user === undefined) return;
    if (!user) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed.map((msg: ChatMessage) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })));
          } else {
            setMessages([]);
          }
        } catch {
          // ignore
        }
      } else {
        setMessages([]);
      }
      setIsReady(true);
    }
  }, [user, mode, storageKey]);

  // ────────────────────────────────────────────────────────────────────────────
  // AUTHENTICATED PATH — async Supabase fetch
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    setIsReady(false);
    setMessages([]);
    loadedCountRef.current = 0;
    setHasMoreOlder(false);
    setCurrentConversation(null);

    let cancelled = false;

    const loadSupabaseMessages = async () => {
      try {
        // Spec 049: restore the most recently active conversation of this
        // (user, mode) — updated_at is bumped server-side on every message
        // insert (tr_touch_conversation_updated_at) — then load only its
        // newest page (CHAT_PAGE_SIZE rows); the retained window is walked
        // backwards via loadOlder. desc + range keeps the "newest rows
        // readable" contract from spec 008 §4, now conversation-scoped.
        const { data: convs, error: convError } = await supabase
          .from("conversations")
          .select("*")
          .eq("user_id", user.id)
          .eq("mode", mode)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (cancelled) return;
        if (convError) throw convError;

        const current = pickCurrentConversation((convs || []) as Conversation[]);
        if (!current) {
          // No conversation yet for this mode — an empty, ready chat. The
          // first send creates one (event-driven, never on mount).
          setIsReady(true);
          return;
        }
        setCurrentConversation(current.id);

        const { data, error } = await supabase
          .from("ai_chat_messages")
          .select("*")
          .eq("user_id", user.id)
          .eq("conversation_id", current.id)
          .order("created_at", { ascending: false })
          .range(0, CHAT_PAGE_SIZE - 1);

        if (cancelled) return;
        if (error) throw error;

        const rows = (data || []) as SupabaseChatMessage[];
        const loadedMessages = rows
          .map((msg) => ({
            id: msg.id,
            type: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(msg.created_at)
          }))
          .reverse();

        loadedCountRef.current = loadedMessages.length;
        setHasMoreOlder(hasMoreAfterLoad(rows.length, CHAT_PAGE_SIZE, loadedMessages.length));
        setMessages(loadedMessages);
      } catch (e) {
        if (!cancelled) {
          logger.error("Failed to load Supabase messages", e);
          setMessages([]);
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    loadSupabaseMessages();
    return () => { cancelled = true; };
  }, [user?.id, mode, setCurrentConversation]);

  // Spec 011: fetch the next older page inside the retained window and
  // PREPEND it. The scroll anchor is preserved by ChatContainer's layout
  // effect (scrollHeight delta), not here.
  const loadOlder = useCallback(async () => {
    const currentConversation = conversationIdRef.current;
    if (!user?.id || !currentConversation || loadingOlderRef.current) return;
    const range = nextOlderRange(loadedCountRef.current);
    if (!range) {
      setHasMoreOlder(false);
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_id", currentConversation)
        .order("created_at", { ascending: false })
        .range(range.start, range.end);

      if (error) throw error;

      const rows = (data || []) as SupabaseChatMessage[];
      const older = rows
        .map((msg) => ({
          id: msg.id,
          type: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at)
        }))
        .reverse();

      loadedCountRef.current = range.start + older.length;
      setHasMoreOlder(hasMoreAfterLoad(older.length, range.end - range.start + 1, loadedCountRef.current));
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
      }
    } catch (e) {
      logger.error("Failed to load older chat messages", e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [user?.id]);

  // ── Puter polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      // Canonical status from lib/puter (spec 041 P1.7 — the assistant kept a
      // divergent copy that ignored the unavailable-until cooldown).
      const status = getPuterStatus();
      setIsPuterSignedIn(status.isSignedIn);
    };
    check();
    const id = setInterval(check, 5000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, []);

  // Guest persistence is EVENT-driven, not state-synced. The old effect
  // wrote on every `messages` change, and since `user` starts as `null`
  // (AuthContext never passes undefined — the `undefined` guards were dead
  // code), the first mount commit saw `messages=[]` and REMOVED the guest
  // key before the restored state re-rendered, re-saving it a beat later.
  // Every page load deleted and rewrote the conversation, and a mode
  // switch briefly wrote the OLD conversation under the NEW mode's key.
  // Now `pendingPersistRef` is raised only by real append events; the
  // effect consumes it once and skips every other commit (mount, mode
  // switch, auth transitions). Deletion stays exclusive to clearChat.
  // Live-mode ref for in-flight guards: the sendMessage closure captures
  // `mode` at call time, so comparing against that captured value could
  // never detect a switch (review 2026-11-07 D3). The ref always holds the
  // current mode.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const pendingPersistRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || user === undefined || user) {
      pendingPersistRef.current = false;
      return;
    }
    if (!pendingPersistRef.current) return;
    pendingPersistRef.current = false;
    if (messages.length > 0) {
      // Spec 008 leftover closed in 011: cap the guest array at the same
      // CHAT_HISTORY_CAP the DB path enforces — oldest dropped first.
      const capped = messages.slice(-CHAT_HISTORY_CAP);
      localStorage.setItem(storageKey, JSON.stringify(capped));
    }
  }, [messages, user, storageKey]);

  const sendMessage = useCallback(async (content: string, modelOverride?: string) => {
    if (!content.trim() || isLoading) return;

    if (mode === 'student_agent' && !studentSelectedSubject) {
      pendingPersistRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_${Date.now()}`,
          type: "assistant",
          // Canned guard reply (spec 041 i18n batch): user-facing assistant
          // content, translated like any other copy.
          content: t("studentAgentNeedsSubject"),
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      type: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    const currentMode = modeRef.current;
    pendingPersistRef.current = true;
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // ── Streaming (spec 011) ────────────────────────────────────────────────
    // The first delta appends the assistant message (streaming: true); later
    // deltas update its content at most once per frame. The persist effect
    // consumes pendingPersistRef once, so intermediate renders stay
    // write-free — only the finalize below persists.
    const assistantMsgId = `assistant_${Date.now()}`;
    let streamStarted = false;
    const flushStream = (full: string) => {
      if (modeRef.current !== currentMode) return;
      if (!streamStarted) {
        streamStarted = true;
        setMessages(prev => [
          ...prev,
          { id: assistantMsgId, type: "assistant", content: full, timestamp: new Date(), streaming: true },
        ]);
      } else {
        setMessages(prev => prev.map(m => (m.id === assistantMsgId ? { ...m, content: full } : m)));
      }
    };
    const deltaThrottle = createDeltaThrottle(flushStream, (cb) => {
      const frame = requestAnimationFrame(cb);
      return () => cancelAnimationFrame(frame);
    });
    const finalizeStream = (finalContent: string): boolean => {
      deltaThrottle.cancel();
      if (!streamStarted) return false;
      streamStarted = false;
      pendingPersistRef.current = true;
      setMessages(prev => prev.map(m => (
        m.id === assistantMsgId ? { ...m, content: finalContent, streaming: false } : m
      )));
      return true;
    };

    // Save user message to Supabase if authenticated. Spec 049: the
    // conversation is ensured first — lazily, inside this send event only —
    // so the row can link to it; a failed create logs and leaves the
    // exchange unlinked instead of blocking the UI. The ensure promise is
    // shared (and reused while in-flight) so the assistant insert below
    // joins the same identity instead of racing the ref write.
    if (user) {
      const ensurePromise =
        conversationIdRef.current != null
          ? Promise.resolve(conversationIdRef.current)
          : (conversationEnsureRef.current ??= ensureConversation(
              user.id,
              mode,
              deriveConversationTitle(content),
            ).then((id) => {
              if (id) setCurrentConversation(id);
              else conversationEnsureRef.current = null; // allow a fresh attempt on the next send
              return id;
            }));
      conversationEnsureRef.current = ensurePromise;
      void ensurePromise
        .then((ensured) => {
          insertChatRow(user.id, mode, ensured, { role: "user", content: content.trim() });
        })
        .catch((e) => logger.warn("chat conversation ensure chain failed", e));
    }

    trackEvent("ai_question_asked", { length: content.length, using_puter_auth: isPuterSignedIn, model: modelOverride });

    try {
      const historyTurns: AiChatHistoryTurn[] = [...messagesRef.current, userMsg]
        .filter(m => m?.content && m.content.trim())
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

      const platformContext = await (async () => {
        if (mode !== 'student_agent') return undefined;

        const scopedQuery = studentSelectedSubject
          ? `${content} (المادة المختارة: ${studentSelectedSubject})`
          : content;

        const built = await buildStudentContext(
          {
            level: academic.level,
            semester: academic.semester,
            department_id: academic.department_id,
          },
          scopedQuery,
        );

        if (!built.context || built.sources.length === 0) return "";
        return built.context;
      })();

    const response = await aiAssistant.generateResponse(content, undefined, {
        mode,
        chatHistory: historyTurns,
        platformContext,
        model: modelOverride,
        locale,
        onDelta: (full) => deltaThrottle.update(full),
      });

      // Avoid setting state if another request was started or mode changed
      if (modeRef.current !== currentMode) {
        deltaThrottle.cancel();
        return;
      }

      const streamed = finalizeStream(response);
      if (!streamed) {
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          type: "assistant",
          content: response,
          timestamp: new Date(),
        };
        pendingPersistRef.current = true;
        setMessages(prev => [...prev, assistantMsg]);
      }

      // Background save assistant response to Supabase, then enforce the
      // retention cap (spec 008 §2, now per conversation — spec 049). The
      // row insert joins the send's ensure outcome (deterministic id, no
      // ref race) and stays fire-and-forget — the spinner clears without
      // waiting on any persistence round-trip. Even when the conversation
      // create failed the row is attempted (unlinked, conversation_id
      // null); only the prune needs a real conversation to scope to.
      if (user) {
        void Promise.resolve(conversationEnsureRef.current)
          .catch(() => null)
          .then((ensured) => {
            insertChatRow(user.id, mode, ensured ?? null, { role: "assistant", content: response });
            if (ensured) pruneChatOverflow(ensured);
          });
      }

    } catch (_e) {
      logger.error("Failed to send AI message", _e);
      deltaThrottle.cancel();
      pendingPersistRef.current = true;
      if (streamStarted) {
        // Rare: an error after partial text was shown (streamPuterChat returns
        // partial content instead of throwing once text arrived). Keep what
        // the user saw; appending the generic error bubble on top of visible
        // content would read as a second failed answer.
        setMessages(prev => prev.map(m => (m.id === assistantMsgId ? { ...m, streaming: false } : m)));
      } else {
        setMessages(prev => [...prev, {
          id: `error_${Date.now()}`,
          type: "assistant",
          // i18n (spec 012 drive-by): was a hardcoded Arabic string.
          content: cannedMessagesFor(locale).genericError,
          timestamp: new Date()
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, trackEvent, isPuterSignedIn, mode, studentSelectedSubject, academic.level, academic.semester, academic.department_id, locale, t, setCurrentConversation]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    loadedCountRef.current = 0;
    setHasMoreOlder(false);
    const previous = conversationIdRef.current;
    setCurrentConversation(null);
    conversationEnsureRef.current = null;
    if (user && previous) {
      // Spec 049: clearing removes the CURRENT conversation — the ownership
      // FK cascade takes its messages with it. The next exchange starts a
      // fresh conversation (created on that send). Guests keep the
      // localStorage removal; deletion stays exclusive to this action.
      await supabase
        .from("conversations")
        .delete()
        .eq("user_id", user.id)
        .eq("id", previous);
    } else if (!user) {
      localStorage.removeItem(storageKey);
    }
  }, [user, storageKey, setCurrentConversation]);

  // Spec 049: swap the transcript to another conversation of this user —
  // same paged contract as the restore (newest page + loadOlder for the
  // rest). Mode-scoped lists are the caller's concern (spec 049 decision):
  // a conversation of another mode loads fine but the caller decides what is
  // listed; the next send still writes under the CURRENT mode.
  const switchConversation = useCallback(async (id: string) => {
    if (!user?.id) return;
    const seq = ++switchSeqRef.current;
    setIsReady(false);
    setMessages([]);
    loadedCountRef.current = 0;
    setHasMoreOlder(false);
    setCurrentConversation(id);
    conversationEnsureRef.current = null;
    try {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .range(0, CHAT_PAGE_SIZE - 1);
      if (seq !== switchSeqRef.current) return;
      if (error) throw error;

      const rows = (data || []) as SupabaseChatMessage[];
      const loadedMessages = rows
        .map((msg) => ({
          id: msg.id,
          type: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at)
        }))
        .reverse();

      loadedCountRef.current = loadedMessages.length;
      setHasMoreOlder(hasMoreAfterLoad(rows.length, CHAT_PAGE_SIZE, loadedMessages.length));
      setMessages(loadedMessages);
    } catch (e) {
      if (seq !== switchSeqRef.current) return;
      logger.error("Failed to switch conversation", e);
      setMessages([]);
    } finally {
      if (seq === switchSeqRef.current) setIsReady(true);
    }
  }, [user?.id, setCurrentConversation]);

  // Spec 049: remove a conversation server-side (ownership FK cascade takes
  // its messages) and, when it is the one on screen, reset the transcript.
  const deleteConversation = useCallback(async (id: string) => {
    if (!user?.id) return;
    if (conversationIdRef.current === id) {
      setMessages([]);
      loadedCountRef.current = 0;
      setHasMoreOlder(false);
      setCurrentConversation(null);
      conversationEnsureRef.current = null;
    }
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", user.id)
      .eq("id", id);
    if (error) logger.warn("conversations delete failed", { error });
  }, [user?.id, setCurrentConversation]);

  const setMode = useCallback((next: AiAssistantMode | ((prev: AiAssistantMode) => AiAssistantMode)) => {
    setModeState((prev) => {
      const actualNext = typeof next === "function" ? next(prev) : next;
      localStorage.setItem("zane_ai_last_mode", actualNext);
      return actualNext;
    });
  }, []);

  return {
    messages,
    // Spec 036 Track A: render-synced mirror — consumers with messages-shaped
    // callback deps (retry) read this so their identity holds while streaming.
    messagesRef,
    isLoading,
    isReady, // Changed from isInitialLoading
    sendMessage,
    clearChat,
    setMessages,
    isPuterSignedIn,
    mode,
    setMode,
    studentSelectedSubject,
    setStudentSelectedSubject,
    // Spec 011: lazy history sync
    loadOlder,
    hasMoreOlder,
    loadingOlder,
    // Spec 049: conversation identity + switch/delete (side menu consumes
    // these in the spec-049 follow-up; no UI ships in 049 itself)
    conversationId,
    switchConversation,
    deleteConversation,
  };
}
