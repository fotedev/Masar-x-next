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
  // Open-sequence control (surfaced by spec 049's CI prod e2e): until the
  // user takes control, any content OR scroller resize re-pins the view.
  // Late-arriving assets (markdown chunk, fonts, hero media metadata) reflow
  // the transcript after the one-shot stick, and Chrome's scroll anchoring
  // can deliver its scroll event BEFORE the ResizeObserver callback for the
  // same reflow — the measured distance then flips isNearBottom and the open
  // view strands (CI: chat opens ~568px above the newest message, pill up).
  const userTookControlRef = useRef(false);
  const lastScrollTopRef = useRef(0);

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

  const onUserIntent = useCallback(() => {
    userTookControlRef.current = true;
  }, []);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    // An UPWARD scroll is always navigation (user, or the loadOlder
    // programmatic jump): while pinned, anchoring only ever adjusts
    // scrollTop downward as content above grows, so an upward move ends the
    // grace window safely. The user-intent events below end it too.
    if (el && el.scrollTop < lastScrollTopRef.current) userTookControlRef.current = true;
    lastScrollTopRef.current = el?.scrollTop ?? 0;
    measure();
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

  // Element-identity sync (runs per messages change; guards keep steady state
  // a no-op during streaming): (re)attach the passive scroll listener when the
  // scroller element appears or is replaced, and (re)observe the list content
  // when its element identity changes (hero <-> list swap, remount).
  useEffect(() => {
    const el = containerRef.current;

    if (el && scrollElRef.current !== el) {
      scrollElRef.current?.removeEventListener("scroll", onScroll);
      el.addEventListener("scroll", onScroll, { passive: true });
      el.addEventListener("wheel", onUserIntent, { passive: true });
      el.addEventListener("touchstart", onUserIntent, { passive: true });
      el.addEventListener("pointerdown", onUserIntent, { passive: true });
      window.addEventListener("keydown", onUserIntent);
      scrollElRef.current = el;
    }

    const content = el?.firstElementChild ?? null;
    if (observedContentRef.current === content) return;
    resizeObserverRef.current?.disconnect();
    observedContentRef.current = content;
    if (!content || !el) {
      resizeObserverRef.current = null;
      return;
    }
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current || !userTookControlRef.current) stickToBottom("instant");
    });
    // Observe the scroller too: header media settling changes clientHeight —
    // the distance math — without any content resize or scroll event.
    ro.observe(content);
    ro.observe(el);
    resizeObserverRef.current = ro;
  }, [messages, onScroll, onUserIntent, stickToBottom]);

  // Hook teardown: the sync effect above intentionally returns no cleanup
  // (it fully re-syncs by identity), so unmount tears down here once.
  useEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      const el = scrollElRef.current;
      el?.removeEventListener("scroll", onScroll);
      el?.removeEventListener("wheel", onUserIntent);
      el?.removeEventListener("touchstart", onUserIntent);
      el?.removeEventListener("pointerdown", onUserIntent);
      window.removeEventListener("keydown", onUserIntent);
      scrollElRef.current = null;
      observedContentRef.current = null;
    },
    [onScroll, onUserIntent],
  );

  return { containerRef, isNearBottom, stickToBottom };
}
