"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { aiAssistant } from "@/lib/ai-assistant";
import type { AiAssistantMode, AiChatHistoryTurn } from "@/lib/ai-assistant";
import { buildStudentContext } from "@/lib/student-agent/contextBuilder";
import { useUserAcademic } from "@/hooks/useUserAcademic";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const CHAT_STORAGE_KEY_PREFIX = "ai_assistant_chat_messages";

export function useAiChat(user: any, trackEvent: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // New: tracks when everything is loaded and ready
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
  const [mode, setModeState] = useState<AiAssistantMode>('cs_assistant');
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
            setMessages(parsed.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })));
          } else {
            setMessages([]);
          }
        } catch (e) {
          console.error("Failed to parse guest messages", e);
          setMessages([]);
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
        const { data, error } = await supabase
          .from("ai_chat_messages")
          .select("*")
          .eq("user_id", user.id)
          .eq("mode", mode)
          .order("created_at", { ascending: true });

        if (cancelled) return;
        if (error) throw error;

        const loadedMessages = (data || []).map((msg: any) => ({
          id: msg.id,
          type: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at)
        })) || [];

        setMessages(loadedMessages);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load Supabase messages", e);
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

  // Persist messages to localStorage (only for guests)
  useEffect(() => {
    if (typeof window === 'undefined' || user) return;
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [messages, user, storageKey]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    if (mode === 'student_agent' && !studentSelectedSubject) {
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
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Save user message to Supabase if authenticated
    if (user) {
      supabase.from("ai_chat_messages").insert({
        user_id: user.id,
        role: "user",
        content: content.trim(),
        mode: mode
      }).then();
    }

    trackEvent("ai_question_asked", { length: content.length, using_puter_auth: isPuterSignedIn });

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
      });

      // Avoid setting state if another request was started or mode changed
      if (mode !== currentMode) return;

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        type: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Background save assistant response to Supabase
      if (user) {
        supabase.from("ai_chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: response,
          mode: mode
        }).then();
      }

    } catch (e) {
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        type: "assistant",
        content: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, trackEvent, isPuterSignedIn, messages, mode, studentSelectedSubject, academic.level, academic.semester, academic.department_id]);

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
    setModeState(next);
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
