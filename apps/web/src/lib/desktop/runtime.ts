/**
 * runtime.ts — Desktop runtime detection (spec 005, FR-010)
 *
 * The Electron window loads the SAME Next.js app that the browser does
 * (see apps/desktop/src/main/server.ts). There is no separate renderer
 * bundle. So every "desktop-only" behavior — the frameless titlebar, the
 * fixed app-shell, the 3-column StudyWorkspace, the hidden download
 * banners and web footer — has to be gated at runtime, not at build time.
 *
 * The single source of truth is the `window.masarxDesktop` object that
 * apps/desktop/src/main/preload.ts installs via contextBridge. If it is
 * present we are inside the Electron shell; if it is absent we are in a
 * plain browser.
 *
 * IMPORTANT (SSR): `isDesktopRuntime()` is FALSE during server rendering
 * because `window` does not exist there. Components must therefore treat
 * "web" as the first-paint default and switch to the desktop layout after
 * hydration via `useIsDesktopRuntime()`. Rendering the desktop shell
 * directly from a server component would produce a hydration mismatch.
 */

/** Shape of the preload bridge that this module probes for. */
export interface MasarxDesktopRuntimeBridge {
  app: {
    version(): Promise<string>;
    platform(): string;
    quit(): Promise<void>;
    /**
     * Open a URL in the system browser (spec 014). Optional so an older
     * shell still satisfies the type; the OAuth flow falls back to
     * `window.open` (which main routes to the system browser anyway)
     * when absent.
     */
    openExternal?(url: string): Promise<void>;
  };
  /**
   * masarx:// deep-link auth surface (spec 014). Optional for the same
   * aging reason as the other namespaces: shells shipped before spec 014
   * expose no `auth` namespace.
   */
  auth?: {
    /**
     * Announce that the renderer's `onDeepLink` subscription is in place
     * and receive (clearing) any deep link that arrived before it — the
     * cold-start OAuth callback race is closed by pull.
     */
    rendererReady(): Promise<string | null>;
    /** Push channel for deep links dispatched after the renderer is ready. */
    onDeepLink(cb: (url: string) => void): () => void;
  };
  /**
   * Window controls for the custom frameless titlebar (spec 005, FR-004).
   * Optional so that an older shell (before spec 005 shipped) still
   * satisfies the type — the titlebar degrades instead of crashing.
   */
  window?: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(cb: (isMaximized: boolean) => void): () => void;
  };
  /**
   * Auto-update surface (T023). Optional for the same aging reason as
   * `window`: shells shipped before the updater landed expose no
   * `updates` namespace. This mirrors apps/desktop/src/main/preload.ts
   * `api.updates` exactly — `updates:available` carries
   * `{ version, releaseDate? }` and `updates:error` carries
   * `{ message }` (both broadcast from updater.ts).
   */
  updates?: {
    check(): Promise<unknown>;
    installAndRestart(): Promise<void>;
    skip(version: string): Promise<void>;
    onAvailable(
      cb: (info: { version: string; releaseDate?: string }) => void,
    ): () => void;
    onError(cb: (info: { message: string }) => void): () => void;
  };
}

/**
 * True when executing inside the Masar X Electron shell.
 *
 * Always false on the server and false in a normal browser tab.
 */
export function isDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { masarxDesktop?: unknown }).masarxDesktop,
  );
}

/**
 * Returns the preload bridge, or `null` when not running in the shell.
 * Callers must null-check; never assume the bridge exists.
 */
export function getDesktopBridge(): MasarxDesktopRuntimeBridge | null {
  if (!isDesktopRuntime()) return null;
  return (window as unknown as { masarxDesktop: MasarxDesktopRuntimeBridge })
    .masarxDesktop;
}
