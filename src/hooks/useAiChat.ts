"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
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

export function useAiChat(user: any, trackEvent: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [loadingMessageCount, setLoadingMessageCount] = useState(true);
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
  const [mode, setMode] = useState<AiAssistantMode>('cs_assistant');

  const chatStorageKey = `${CHAT_STORAGE_KEY_PREFIX}_${mode}`;

  // Check Puter status on mount
  useEffect(() => {
    const checkPuterStatus = () => {
      const status = aiAssistant.getPuterStatus();
      setIsPuterSignedIn(status.isSignedIn);
    };

    checkPuterStatus();
    // Optional: Poll for status changes or listen to events if available
    const interval = setInterval(checkPuterStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const messageLimit = user ? REGISTERED_MESSAGE_LIMIT : GUEST_MESSAGE_LIMIT;


  // If signed in to Puter, user has unlimited messages (subject to Puter's own limits)
  const hasReachedLimit = isPuterSignedIn ? false : dailyMessageCount >= messageLimit;
  const remainingMessages = isPuterSignedIn ? 999 : Math.max(0, messageLimit - dailyMessageCount);

  // Load messages from localStorage (per mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setMessages(parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        } catch (e) {
          console.error("Failed to parse chat messages", e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [chatStorageKey]);

  // Persist messages (per mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (messages.length > 0) {
        localStorage.setItem(chatStorageKey, JSON.stringify(messages));
      } else {
        localStorage.removeItem(chatStorageKey);
      }
    }
  }, [messages, chatStorageKey]);

  // Load message count
  useEffect(() => {
    const loadCount = async () => {
      setLoadingMessageCount(true);
      if (user) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { count } = await supabase
            .from("assistant_messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", today.toISOString());
          setDailyMessageCount(count || 0);
        } catch (e) {
          setDailyMessageCount(0);
        }
      } else {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(GUEST_COUNT_KEY);
          if (stored) {
            const { count, date } = JSON.parse(stored);
            if (date === new Date().toDateString()) {
              setDailyMessageCount(count);
            } else {
              setDailyMessageCount(0);
            }
          }
        }
      }
      setLoadingMessageCount(false);
    };
    loadCount();
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Check limit again (unless Puter signed in)
    if (!isPuterSignedIn && hasReachedLimit) return;

    const startTime = Date.now();
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      type: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

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

      // Background save to Supabase
      if (user) {
        supabase.from("assistant_messages").insert({
          user_id: user.id,
          session_id: getSessionId(),
          user_message: content,
          assistant_response: response,
          response_time_ms: Date.now() - startTime,
          ai_model_used: "gpt-4o",
          metadata: { provider: "puter.js", authenticated: isPuterSignedIn }
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

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(chatStorageKey);
  }, [chatStorageKey]);

  return {
    messages,
    isLoading,
    remainingMessages,
    hasReachedLimit,
    loadingMessageCount,
    sendMessage,
    clearChat,
    setMessages,
    messageLimit,
    isPuterSignedIn,
    mode,
    setMode,
  };
}
