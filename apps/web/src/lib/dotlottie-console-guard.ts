/**
 * Global console filter for the dotLottie worker (moved verbatim out of
 * LottiePlayer.tsx — spec 012 item G1).
 *
 * The underlying `dotlottie-web` worker calls `console.error` directly (not
 * just rejects a Promise) when the `stateMachine` inside the .lottie file
 * references an animation id that the worker can't resolve (the manifest's
 * animation is `main_scene` while the state machine's states still say
 * `Main Scene`, so every `stateMachineStart()` fails with
 * `Failed to load animation with id: Main Scene`). The avatar still plays
 * fine because the worker falls back to the first available animation, but
 * the red banner in the Next.js dev overlay is just noise.
 *
 * The state machine load is *always* going to fail for this file, so the
 * filter has to be active for the entire app lifetime — installing it inside
 * a `useEffect` left a window where the error could slip through (e.g. when
 * one LottiePlayer unmounts and the next one mounts during a
 * chat/initial-state switch). Installing once at module load guarantees the
 * override is in place before any worker has a chance to log.
 *
 * Living in its own module (side-effect import) keeps unrelated errors from
 * being stack-attributed to LottiePlayer.tsx in dev overlays.
 */

if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console -- intentional capture of the original
  const originalError = console.error;
  // eslint-disable-next-line no-console -- intentional capture of the original
  const originalWarn = console.warn;
  const isSuppressed = (args: unknown[]): boolean => {
    for (const a of args) {
      if (typeof a === "string" && a.includes("Failed to load animation")) {
        return true;
      }
    }
    return false;
  };
  // eslint-disable-next-line no-console -- intentional override of console.error
  console.error = (...args: unknown[]) => {
    if (isSuppressed(args)) return;
    originalError.apply(console, args);
  };
  // eslint-disable-next-line no-console -- intentional override of console.warn
  console.warn = (...args: unknown[]) => {
    if (isSuppressed(args)) return;
    originalWarn.apply(console, args);
  };
}
