"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * The two assistant states. The avatar switches between them by crossfading
 * two permanently-mounted videos — the source never swaps, so there is no
 * reload flash and the inactive clip stays buffered (spec 048).
 */
export type ZaneStatus = "idle" | "working";

const STATUSES = ["idle", "working"] as const;

/**
 * `play()` returns a Promise in real browsers but `undefined` under jsdom's
 * media stub — guard both shapes so tests never surface an unhandled
 * rejection or a TypeError.
 */
const safePlay = (el: HTMLVideoElement) => {
  const p = el.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      // autoplay/Low-Power rejection — the poster frame stays visible
    });
  }
};

const VIDEOS: Record<ZaneStatus, { src: string; poster: string }> = {
  idle: {
    src: "/zane/zane-idle-face.mp4",
    poster: "/zane/zane-idle-face-poster.png",
  },
  working: {
    src: "/zane/zane-typing-close.mp4",
    poster: "/zane/zane-typing-close-poster.png",
  },
};

/**
 * Circular status video avatar (Muse-style). Exactly one of the two clips
 * plays at a time: the active one, unless reduced motion is requested or the
 * tab is hidden — those cases stay paused on their poster/first frame.
 *
 * Playback is driven from effects against stable element refs (never from
 * ref callbacks, which fire on every render), and every `play()` is guarded
 * so browsers/tests that reject it can never surface an unhandled rejection.
 */
export function ZaneAvatar({
  status,
  className,
}: {
  status: ZaneStatus;
  className?: string;
}) {
  const videoRefs = useRef<Record<ZaneStatus, HTMLVideoElement | null>>({
    idle: null,
    working: null,
  });
  const shouldReduceMotion = useReducedMotion();

  const syncPlayback = useCallback(() => {
    for (const s of STATUSES) {
      const el = videoRefs.current[s];
      if (!el) continue;
      const active = s === status && !shouldReduceMotion && !document.hidden;
      if (active && el.paused) {
        safePlay(el);
      } else if (!active && !el.paused) {
        el.pause();
      }
    }
  }, [status, shouldReduceMotion]);

  useEffect(() => {
    syncPlayback();
  }, [syncPlayback]);

  useEffect(() => {
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [syncPlayback]);

  return (
    <div className={`relative overflow-hidden rounded-full ${className ?? ""}`}>
      {STATUSES.map((s) => (
        <video
          key={s}
          ref={(el) => {
            videoRefs.current[s] = el;
          }}
          src={VIDEOS[s].src}
          poster={VIDEOS[s].poster}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden={s !== status}
          style={{ opacity: s === status ? 1 : 0 }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
        />
      ))}
    </div>
  );
}
