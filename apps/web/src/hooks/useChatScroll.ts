"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 100;

/**
 * Scroll behavior for the chat stream (spec 011).
 *
 * - Sticks to the bottom only while the user is already near it: streamed
 *   content growth and newly appended messages pin the view instantly, but
 *   scrolling up to read history is never fought.
 * - A fresh thread (messages emptied by a mode switch, clear, or a completed
 *   history sync on open) resets the stick state, so the first render of
 *   restored history jumps straight to the newest message — instant, not a
 *   smooth crawl through up to 100 bubbles.
 * - `isNearBottom` drives the floating scroll-to-end pill.
 */
export function useChatScroll(messages: readonly unknown[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);

  const stickToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setIsNearBottom(true);
  }, []);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= NEAR_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
  }, []);

  // Track user detachment on scroll (passive — never blocks the scroll path).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [measure]);

  useEffect(() => {
    if (messages.length === 0) {
      // Fresh thread: the next sync render should land at the newest message.
      isNearBottomRef.current = true;
      setIsNearBottom(true);
      return;
    }
    if (isNearBottomRef.current) {
      stickToBottom("instant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return { containerRef, isNearBottom, stickToBottom };
}
