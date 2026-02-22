"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { aiAssistant } from "@/lib/ai-assistant";
import type { AiAssistantMode, AiChatHistoryTurn } from "@/lib/ai-assistant";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const GUEST_MESSAGE_LIMIT = 2;
const REGISTERED_MESSAGE_LIMIT = 5;
const CHAT_STORAGE_KEY_PREFIX = "ai_assistant_chat_messages";
const GUEST_COUNT_KEY = "ai_daily_count_guest";

import { signInToPuter } from "@/lib/puter";

export function useAiChat(user: any, trackEvent: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // New: tracks when everything is loaded and ready
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [loadingMessageCount, setLoadingMessageCount] = useState(true);
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
  const [mode, setModeState] = useState<AiAssistantMode>('cs_assistant');
  const storageKey = `${CHAT_STORAGE_KEY_PREFIX}_${mode}`;

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
          setMessages(parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
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
    if (!user) return;

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

        const loadedMessages = data?.map((msg: any) => ({
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
  }, [user, mode]);

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

  const messageLimit = user ? REGISTERED_MESSAGE_LIMIT : GUEST_MESSAGE_LIMIT;

  // If signed in to Puter, user has unlimited messages (subject to Puter's own limits)
  const hasReachedLimit = isPuterSignedIn ? false : dailyMessageCount >= messageLimit;
  const remainingMessages = isPuterSignedIn ? 999 : Math.max(0, messageLimit - dailyMessageCount);

  // Persist messages to localStorage (only for guests)
  useEffect(() => {
    if (typeof window === 'undefined' || user) return;
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [messages, user, storageKey]);

  // ── Daily message count ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      setLoadingMessageCount(true);
      if (user) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count } = await supabase
            .from("ai_chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("role", "user")
            .gte("created_at", today.toISOString());
          if (!cancelled) setDailyMessageCount(count || 0);
        } catch (e) {
          if (!cancelled) setDailyMessageCount(0);
        }
      } else {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(GUEST_COUNT_KEY);
          if (stored) {
            try {
              const { count, date } = JSON.parse(stored);
              if (!cancelled) {
                setDailyMessageCount(date === new Date().toDateString() ? count : 0);
              }
            } catch (e) {
              if (!cancelled) setDailyMessageCount(0);
            }
          }
        }
      }
      if (!cancelled) setLoadingMessageCount(false);
    };
    loadCount();
    return () => { cancelled = true; };
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Check limit again (unless Puter signed in)
    if (!isPuterSignedIn && hasReachedLimit) {
      // Automatically trigger Puter login if limit reached
      const success = await signInToPuter();
      if (!success) return; // User cancelled or error
      // If success, we continue to send the message because isPuterSignedIn will be updated by polling
      // but we need to wait a bit or use the local status
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      type: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

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

    // Increment local count if not using Puter login (or even if using it, to track usage)
    const newCount = dailyMessageCount + 1;
    setDailyMessageCount(newCount);

    if (!user && typeof window !== 'undefined') {
      localStorage.setItem(GUEST_COUNT_KEY, JSON.stringify({
        count: newCount,
        date: new Date().toDateString()
      }));
    }

    trackEvent("ai_question_asked", { length: content.length, using_puter_auth: isPuterSignedIn });

    try {
      const historyTurns: AiChatHistoryTurn[] = [...messages, userMsg]
        .filter(m => m?.content && m.content.trim())
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

      const response = await aiAssistant.generateResponse(content, undefined, {
        mode,
        chatHistory: historyTurns,
      });
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
  }, [user, dailyMessageCount, hasReachedLimit, isLoading, trackEvent, isPuterSignedIn, messages, mode]);

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
    remainingMessages,
    hasReachedLimit,
    loadingMessageCount,
    isReady, // Changed from isInitialLoading
    sendMessage,
    clearChat,
    setMessages,
    messageLimit,
    isPuterSignedIn,
    mode,
    setMode,
  };
}
