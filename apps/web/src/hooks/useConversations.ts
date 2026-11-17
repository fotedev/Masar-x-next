"use client";

import { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import { CHAT_PAGE_SIZE, hasMoreAfterLoad } from "@/lib/chat-pagination";
import type { Conversation } from "@/types/database";
import { logger } from "@/lib/logger";

/**
 * Read side of server-backed chat history (spec 049): the paged conversation
 * list a signed-in user can switch between. Mode-scoped per the spec — the
 * list hook takes the current mode filter; whether the spec-049 follow-up UI
 * shows all modes is its own decision. Strictly read-only: writes live in
 * useAiChat (create on send, delete on clear/deleteConversation), so this
 * hook can never violate the event-driven persistence policy.
 *
 * Plain state like useAiChat (no TanStack): the list is small, paged with the
 * same range/short-page contract as the message history.
 */
export function useConversations(user: User | null | undefined, mode: AiAssistantMode) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCountRef = useRef(0);
  // Shared request generation (CodeRabbit Major): the effect load, loadMore
  // and refresh all bump it at start; a completion may only write rows or
  // pagination state while its generation is still current — a slow loadMore
  // for a superseded list can never append stale rows to (or replace) a newer
  // fetch's result (mode change, refresh, newer loadMore).
  const requestGenRef = useRef(0);

  const queryPage = useCallback(async (userId: string, offset: number): Promise<Conversation[]> => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, user_id, mode, title, created_at, updated_at")
      .eq("user_id", userId)
      .eq("mode", mode)
      .order("updated_at", { ascending: false })
      .range(offset, offset + CHAT_PAGE_SIZE - 1);

    if (error) throw error;
    return ((data || []) as Conversation[]).filter((row) => typeof row?.id === "string");
  }, [mode]);

  const applyPage = useCallback((rows: Conversation[], offset: number) => {
    loadedCountRef.current = offset + rows.length;
    setHasMore(hasMoreAfterLoad(rows.length, CHAT_PAGE_SIZE, loadedCountRef.current));
    if (offset === 0) {
      setConversations(rows);
    } else {
      setConversations((prev) => [...prev, ...rows]);
    }
  }, []);

  const fetchPage = useCallback(async (offset: number) => {
    const gen = ++requestGenRef.current;
    if (!user?.id) {
      loadedCountRef.current = 0;
      setConversations([]);
      setHasMore(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await queryPage(user.id, offset);
      if (requestGenRef.current !== gen) return;
      applyPage(rows, offset);
    } catch (e) {
      if (requestGenRef.current !== gen) return;
      logger.error("Failed to load conversations", e);
      if (offset === 0) setConversations([]);
      setHasMore(false);
    } finally {
      // Only the winning request owns the loading flag — a superseded one
      // must not clear it out from under the newer fetch.
      if (requestGenRef.current === gen) setLoading(false);
    }
  }, [user?.id, queryPage, applyPage]);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await fetchPage(loadedCountRef.current);
  }, [fetchPage, loading, hasMore]);

  const refresh = useCallback(async () => {
    await fetchPage(0);
  }, [fetchPage]);

  return { conversations, loading, hasMore, loadMore, refresh };
}
