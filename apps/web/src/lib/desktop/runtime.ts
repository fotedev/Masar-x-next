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
 *
 * Spec 015: the bridge shape lives in packages/shared/src/types/desktop-bridge.ts
 * (single source of truth). This file is now a thin re-export of the type
 * plus the runtime-probe helpers. Adding a new IPC channel requires
 * editing the shared module — both sides pick up the change automatically.
 */

import type { MasarxDesktopRuntimeBridge } from 'masarx-shared/types/desktop-bridge';
export type { MasarxDesktopRuntimeBridge };

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
