"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

const MIN_THUMB_PX = 36;
const TRACK_INSET_PX = 8; // inset-y-2 on the overlay

/**
 * Overlay scrollbar for the chat stream (spec 011). The native scrollbar
 * stays hidden (`chat-scrollbar-hidden`) so the centered message column keeps
 * its exact width on classic-scrollbar platforms; this thumb instead docks at
 * the scroller's physical right edge with full drag + track-click-to-jump,
 * and auto-hides whenever the content fits (hero state included).
 */
export function ChatScrollbar({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [thumb, setThumb] = useState<{ height: number; top: number }>({ height: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const trackHRef = useRef(0);

  const update = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight - clientHeight;
    if (scrollHeight <= clientHeight + 4 || scrollable <= 0) {
      setVisible(false);
      setThumb({ height: 0, top: 0 });
      return;
    }
    const trackH = clientHeight - TRACK_INSET_PX * 2;
    trackHRef.current = trackH;
    const height = Math.max(MIN_THUMB_PX, (clientHeight / scrollHeight) * trackH);
    const top = (scrollTop / scrollable) * (trackH - height);
    setVisible(true);
    setThumb({ height, top });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    update();
    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Content growth (streaming) resizes the inner column, not the scroller
    // itself — observe both so the thumb tracks streamed height too.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [containerRef, update]);

  const thumbHeightNow = () =>
    Math.max(
      MIN_THUMB_PX,
      (() => {
        const el = containerRef.current;
        if (!el || el.scrollHeight <= 0) return MIN_THUMB_PX;
        return (el.clientHeight / el.scrollHeight) * trackHRef.current;
      })(),
    );

  const onThumbPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || trackHRef.current <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Belt-and-braces: even without the scroll-smooth class, any inherited
    // smooth scroll-behavior would animate the direct scrollTop writes below
    // and delay the drag (spec 012).
    el.style.scrollBehavior = "auto";
    dragState.current = { startY: e.clientY, startScrollTop: el.scrollTop };
  };

  const onThumbPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const el = containerRef.current;
    if (!drag || !el) return;
    const trackH = trackHRef.current;
    const scrollable = el.scrollHeight - el.clientHeight;
    const denominator = trackH - thumbHeightNow();
    const ratio = denominator > 0 ? (e.clientY - drag.startY) / denominator : 0;
    el.scrollTop = drag.startScrollTop + ratio * scrollable;
  };

  const endDrag = () => {
    const el = containerRef.current;
    if (el) el.style.scrollBehavior = "";
    dragState.current = null;
  };

  // Bare-track clicks (not the thumb) jump so the thumb centers on the click.
  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const el = containerRef.current;
    if (!el || trackHRef.current <= 0) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const thumbH = thumbHeightNow();
    const denominator = trackHRef.current - thumbH;
    const ratio = denominator > 0 ? (clickY - thumbH / 2) / denominator : 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    el.scrollTo({ top: clamped * scrollable, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-y-2 right-1 z-30 w-2"
      aria-hidden="true"
    >
      <div
        className="pointer-events-auto absolute inset-0 rounded-full transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-700/40"
        onPointerDown={onTrackPointerDown}
      >
        <div
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="pointer-events-auto absolute left-0 w-1.5 cursor-pointer touch-none rounded-full bg-slate-400/60 transition-colors hover:bg-cyan-500/80 dark:bg-slate-500/60 dark:hover:bg-cyan-400/80"
          style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
        />
      </div>
    </div>
  );
}
