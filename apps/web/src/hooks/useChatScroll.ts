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
 * - The scroll listener and the content ResizeObserver (re)attach by element
 *   identity: the scroller does not exist yet on the spinner-first
 *   authenticated load, so a mount-once attachment leaves measure() dead
 *   forever — isNearBottom freezes true, every content resize re-pins users
 *   who had scrolled away, and the scroll-to-end pill can never appear.
 * - The ResizeObserver re-pins on content height changes (LazyMarkdown chunk
 *   mount, fonts, KaTeX) while the user is near the bottom — the one-shot
 *   stick measures LazyMarkdown's placeholder heights on open.
 * - `isNearBottom` drives the floating scroll-to-end pill.
 */
export function useChatScroll(messages: readonly unknown[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const observedContentRef = useRef<Element | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const scrollElRef = useRef<HTMLDivElement | null>(null);

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

  const onScroll = useCallback(() => measure(), [measure]);

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

  // Element-identity sync (runs per messages change; guards keep steady state
  // a no-op during streaming): (re)attach the passive scroll listener when the
  // scroller element appears or is replaced, and (re)observe the list content
  // when its element identity changes (hero <-> list swap, remount).
  useEffect(() => {
    const el = containerRef.current;

    if (el && scrollElRef.current !== el) {
      scrollElRef.current?.removeEventListener("scroll", onScroll);
      el.addEventListener("scroll", onScroll, { passive: true });
      scrollElRef.current = el;
    }

    const content = el?.firstElementChild ?? null;
    if (observedContentRef.current === content) return;
    resizeObserverRef.current?.disconnect();
    observedContentRef.current = content;
    if (!content) {
      resizeObserverRef.current = null;
      return;
    }
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) stickToBottom("instant");
    });
    ro.observe(content);
    resizeObserverRef.current = ro;
  }, [messages, onScroll, stickToBottom]);

  // Hook teardown: the sync effect above intentionally returns no cleanup
  // (it fully re-syncs by identity), so unmount tears down here once.
  useEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      scrollElRef.current?.removeEventListener("scroll", onScroll);
      scrollElRef.current = null;
      observedContentRef.current = null;
    },
    [onScroll],
  );

  return { containerRef, isNearBottom, stickToBottom };
}
