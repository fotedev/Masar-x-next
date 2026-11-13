/**
 * ZANE status avatar for mobile (spec 048). expo-av is isolated to this
 * file — no other app code imports the video API directly, so the player
 * stays swappable. Two permanently-mounted videos crossfade by opacity on
 * the status change (the source never swaps, so there is no reload flash);
 * the inactive one is paused and both pause when the app is backgrounded.
 *
 * PiP note: Muse's home-screen floating window is an Android voice-call
 * Activity feature — expo-av provides none and none is wired here.
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState, StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";

const IDLE_SOURCE = require("../../assets/zane/zane-idle-face.mp4") as number;
const TYPING_SOURCE = require("../../assets/zane/zane-typing-close.mp4") as number;

export type ZaneStatus = "idle" | "working";

const STATUSES = ["idle", "working"] as const;

const SOURCES: Record<ZaneStatus, number> = {
  idle: IDLE_SOURCE,
  working: TYPING_SOURCE,
};

export function ZaneAvatarRN({ status }: { status: ZaneStatus }) {
  const refs = useRef<Record<ZaneStatus, Video | null>>({
    idle: null,
    working: null,
  });

  const syncPlayback = useCallback(() => {
    for (const s of STATUSES) {
      const ref = refs.current[s];
      if (!ref) continue;
      const active = s === status && AppState.currentState === "active";
      if (active) {
        void ref.playAsync().catch(() => {
          // playback rejection (e.g. mid-load) — poster-less first frame shows
        });
      } else {
        void ref.pauseAsync().catch(() => {});
      }
    }
  }, [status]);

  useEffect(() => {
    syncPlayback();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncPlayback();
      } else {
        for (const s of STATUSES) {
          const ref = refs.current[s];
          if (ref) void ref.pauseAsync().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [syncPlayback]);

  return (
    <>
      {STATUSES.map((s) => (
        <Video
          key={s}
          ref={(el) => {
            refs.current[s] = el;
          }}
          style={[StyleSheet.absoluteFill, styles.video, { opacity: s === status ? 1 : 0 }]}
          source={SOURCES[s]}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          useNativeControls={false}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  video: { borderRadius: 999 },
});
