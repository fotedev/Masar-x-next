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
import { setWasmUrl } from "@lottiefiles/dotlottie-react";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";
// Spec 012: the dotLottie worker's known-noise console filter now lives in
// its own module (side-effect import) so unrelated console errors are no
// longer stack-attributed to LottiePlayer.tsx.
import "@/lib/dotlottie-console-guard";

// Self-host the dotlottie-web WASM blob from /public. By default the
// library fetches it from `cdn.jsdelivr.net`, which gets blocked by the
// production CSP on Vercel (script-src does not include 'unsafe-eval',
// so `WebAssembly.instantiateStreaming()` fails and the avatar never
// starts). Calling `setWasmUrl` before any `<DotLottieReact>` mount
// redirects the fetch to the same-origin copy, which Next.js serves
// with the correct `application/wasm` MIME type and which is allowed
// by the existing CSP without relaxing any directives.
if (typeof window !== "undefined") {
  setWasmUrl("/dotlottie-player.wasm");
}

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
