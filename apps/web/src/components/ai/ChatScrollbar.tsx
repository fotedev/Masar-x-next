"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  TRACK_INSET_PX,
  dragRatio,
  scrollTopForRatio,
  thumbHeight,
} from "@/lib/chat-scrollbar";

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
  // Issue #241: the drag is POSITION-based — fresh track geometry is captured
  // at pointerdown (the old delta-based drag relied on trackHRef/thumb math
  // that could desync from the rendered thumb, leaving the end unreachable).
  const dragState = useRef<{ trackTop: number; trackH: number; thumbH: number } | null>(null);

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
    const height = thumbHeight(clientHeight, scrollHeight, trackH);
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

  const onThumbPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    const track = e.currentTarget.parentElement;
    if (!el || !track || thumb.height <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Belt-and-braces: even without the scroll-smooth class, any inherited
    // smooth scroll-behavior would animate the direct scrollTop writes below
    // and delay the drag (spec 012).
    el.style.scrollBehavior = "auto";
    const rect = track.getBoundingClientRect();
    dragState.current = {
      trackTop: rect.top,
      trackH: rect.height,
      // The currently RENDERED thumb height — visuals and drag math agree by
      // construction instead of through a ref that can go stale.
      thumbH: thumb.height,
    };
  };

  const onThumbPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const el = containerRef.current;
    if (!drag || !el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    // Fresh per move: streamed content can change the scroll span mid-drag.
    el.scrollTop = scrollTopForRatio(dragRatio(e.clientY, drag.trackTop, drag.thumbH, drag.trackH), scrollable);
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
    if (!el || thumb.height <= 0) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = dragRatio(e.clientY, rect.top, thumb.height, rect.height);
    el.scrollTo({ top: scrollTopForRatio(ratio, scrollable), behavior: "smooth" });
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
