"use client";

import { User } from "@supabase/supabase-js";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import { aiAssistant } from "@/lib/ai-assistant";
import type { AiAssistantMode, AiChatHistoryTurn } from "@/lib/ai-assistant";
import { buildStudentContext } from "@/lib/student-agent/contextBuilder";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { logger } from "@/lib/logger";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const CHAT_STORAGE_KEY_PREFIX = "ai_assistant_chat_messages";

// Spec 008: retention cap — load the newest 100 rows per (user, mode) and
// prune older rows after each assistant reply.
const CHAT_HISTORY_CAP = 100;

interface SupabaseChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// Spec 008: fire-and-forget inserts must never throw into the chat flow, but
// failures are surfaced to the logger (previously the .then() was discarded).
const insertChatRow = (userId: string, chatMode: string, row: { role: "user" | "assistant"; content: string }) => {
  supabase
    .from("ai_chat_messages")
    .insert({ user_id: userId, role: row.role, content: row.content, mode: chatMode })
    .then(({ error }) => {
      if (error) logger.warn("ai_chat_messages insert failed", { error });
    });
};

// Keep each (user, mode) thread at the newest CHAT_HISTORY_CAP rows: probe the
// overflow window (rows 101–200 newest) and delete it when present.
const pruneChatOverflow = (userId: string, chatMode: string) => {
  supabase
    .from("ai_chat_messages")
    .select("id")
    .eq("user_id", userId)
    .eq("mode", chatMode)
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // New: tracks when everything is loaded and ready
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
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

    let cancelled = false;

    const loadSupabaseMessages = async () => {
      try {
        // desc + limit loads the NEWEST cap rows; asc + limit would return
        // the oldest 100 instead (spec 008 §4's contract is "newest 100
        // readable"). Reversed back to chronological order for rendering.
        const { data, error } = await supabase
          .from("ai_chat_messages")
          .select("*")
          .eq("user_id", user.id)
          .eq("mode", mode)
          .order("created_at", { ascending: false })
          .limit(CHAT_HISTORY_CAP);

        if (cancelled) return;
        if (error) throw error;

        const loadedMessages = ((data || []) as SupabaseChatMessage[])
          .map((msg) => ({
            id: msg.id,
            type: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(msg.created_at)
          }))
          .reverse();

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
  }, [user?.id, mode]);

  // ── Puter polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const status = aiAssistant.getPuterStatus();
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
  const pendingPersistRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || user === undefined || user) {
      pendingPersistRef.current = false;
      return;
    }
    if (!pendingPersistRef.current) return;
    pendingPersistRef.current = false;
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
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
          content: "لا يمكنني الإجابة من المنصة بدون اختيار المادة أولاً. اختر المادة من القائمة ثم أعد إرسال سؤالك.",
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

    const currentMode = mode;
    pendingPersistRef.current = true;
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Save user message to Supabase if authenticated
    if (user) {
      insertChatRow(user.id, mode, { role: "user", content: content.trim() });
    }

    trackEvent("ai_question_asked", { length: content.length, using_puter_auth: isPuterSignedIn, model: modelOverride });

    try {
      const historyTurns: AiChatHistoryTurn[] = [...messages, userMsg]
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
      });

      // Avoid setting state if another request was started or mode changed
      if (mode !== currentMode) return;

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        type: "assistant",
        content: response,
        timestamp: new Date(),
      };
      pendingPersistRef.current = true;
      setMessages(prev => [...prev, assistantMsg]);

      // Background save assistant response to Supabase, then enforce the
      // retention cap (spec 008 §2)
      if (user) {
        insertChatRow(user.id, mode, { role: "assistant", content: response });
        pruneChatOverflow(user.id, mode);
      }

    } catch (_e) {
      logger.error("Failed to send AI message", _e);
      pendingPersistRef.current = true;
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        type: "assistant",
        content: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, trackEvent, isPuterSignedIn, messages, mode, studentSelectedSubject, academic.level, academic.semester, academic.department_id, locale]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    if (user) {
      await supabase
        .from("ai_chat_messages")
        .delete()
        .eq("user_id", user.id)
        .eq("mode", mode);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [user, mode, storageKey]);

  const setMode = useCallback((next: AiAssistantMode | ((prev: AiAssistantMode) => AiAssistantMode)) => {
    setModeState((prev) => {
      const actualNext = typeof next === "function" ? next(prev) : next;
      localStorage.setItem("zane_ai_last_mode", actualNext);
      return actualNext;
    });
  }, []);

  return {
    messages,
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
  };
}
