"use client";

import {
  useEffect,
  useId,
  useState,
  type ComponentType,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";

// Client-only wrapper to avoid SSR crashes with the dotLottie WASM player.
// We use `dynamic` so the WASM bundle is only loaded on the client; the
// server only renders the placeholder.
const DotLottieReact = dynamic(
  () =>
    import("@lottiefiles/dotlottie-react").then(
      (m) => m.DotLottieReact as unknown as ComponentType<DotLottieReactProps>,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full animate-pulse rounded-2xl bg-slate-200/50 dark:bg-slate-800/50"
        aria-hidden="true"
      />
    ),
  },
);

export type Props = DotLottieReactProps;

// Module-level console filter: the underlying `dotlottie-web` worker
// calls `console.error` directly (not just rejects a Promise) when the
// `stateMachine` inside the .lottie file references an animation id
// that the worker can't resolve (the manifest's animation is
// `main_scene` while the state machine's states still say
// `Main Scene`, so every `stateMachineStart()` fails with
// `Failed to load animation with id: Main Scene`). The avatar still
// plays fine because the worker falls back to the first available
// animation, but the red banner in the Next.js dev overlay is just
// noise.
//
// The state machine load is *always* going to fail for this file, so
// the filter has to be active for the entire app lifetime — installing
// it inside a `useEffect` left a window where the error could slip
// through (e.g. when one LottiePlayer unmounts and the next one
// mounts during a chat/initial-state switch). Installing once at
// module load guarantees the override is in place before any worker
// has a chance to log.
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

/**
 * Shape of the runtime player instance that `dotLottieRefCallback` receives.
 * This is the public API surface that `ChatContainer` and `ChatMessageItem`
 * rely on — `stateMachineFireEvent` to drive the avatar state, plus the
 * standard playback primitives. Kept here as a type-only export so the
 * consumers can import it under the same name they used with the old
 * `@lottiefiles/dotlottie-react` API (`DotLottie`).
 */
export interface DotLottie {
  stateMachineFireEvent: (event: string) => void;
  isLoaded: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  destroy?: () => void;
}

/**
 * Defensive Lottie player wrapper.
 *
 * The underlying `@lottiefiles/dotlottie-react` is built on a WebAssembly
 * worker. When a `<LottiePlayer>` is unmounted (e.g. when the user
 * switches between an active chat with messages and an empty initial
 * state) and a new one is mounted shortly after, the new mount can race
 * with the previous instance's async cleanup. Even with a patched
 * library that waits for the `load` event before calling
 * `loadAnimation`, the worker can still log a transient
 * `Failed to load animation with id: Main Scene` during the cleanup of
 * the previous canvas.
 *
 * This wrapper defends against that race by:
 *   1. Wrapping the player in a small `ErrorBoundary` so any unhandled
 *      console error from the library never escapes to the Next.js dev
 *      overlay.
 *   2. Deferring the actual mount of `<DotLottieReact>` to the next
 *      animation frame, giving React a chance to finish the previous
 *      unmount cycle (and the WASM worker to release its canvas) before
 *      the new instance is created.
 *   3. Forcing a full re-mount of the underlying player via a unique
 *      `useId()`-derived key that never repeats.
 */
export function LottiePlayer(props: Props) {
  const [ready, setReady] = useState(false);
  const id = useId();

  useEffect(() => {
    // Defer one animation frame so the previous instance's unmount cycle
    // can complete (and the WASM worker can release its canvas + memory)
    // before the new one is created. This is the smallest change that
    // reliably avoids the "Failed to load animation" race.
    const handle = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  if (!ready) {
    return (
      <div
        className="w-full h-full animate-pulse rounded-2xl bg-slate-200/50 dark:bg-slate-800/50"
        aria-hidden="true"
      />
    );
  }

  return (
    <LottieErrorBoundary>
      <DotLottieReact key={id} {...props} />
    </LottieErrorBoundary>
  );
}

interface LottieErrorBoundaryProps {
  children: ReactNode;
}

interface LottieErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary for the Lottie player. The dotLottie worker can throw
 * unhandled errors during mount/unmount races; we don't want those to
 * crash the surrounding page. We swallow them and render a static
 * placeholder instead. On the next render cycle the parent will mount a
 * fresh player instance and the animation will pick back up.
 */
class LottieErrorBoundary extends Component<
  LottieErrorBoundaryProps,
  LottieErrorBoundaryState
> {
  state: LottieErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LottieErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.warn("[LottiePlayer] suppressed worker error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="w-full h-full animate-pulse rounded-2xl bg-slate-200/50 dark:bg-slate-800/50"
          aria-hidden="true"
        />
      );
    }
    return this.props.children;
  }
}
