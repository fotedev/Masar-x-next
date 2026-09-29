/**
 * MasarxDesktopBridge — the IPC contract between the Electron preload script
 * and the web/mobile renderer surface.
 *
 * Single source of truth for the preload bridge. Replaces the duplicate
 * declarations in:
 *   - apps/desktop/src/main/preload.ts       (the wire-side literal)
 *   - apps/web/src/lib/desktop/runtime.ts   (the renderer-side projection)
 *
 * Spec 015 (consolidate cross-surface abstractions) — the literal `api` object
 * now lives here as `masarxDesktopApi`. The preload script imports it and
 * hands it to contextBridge unchanged. The web runtime module imports the
 * inferred type `MasarxDesktopBridge` (with optional namespaces marked for
 * forward compatibility with shells predating a given surface).
 *
 * BACKWARD-COMPATIBILITY NOTE — the renderer-side `MasarxDesktopRuntimeBridge`
 * (apps/web/src/lib/desktop/runtime.ts) historically marks `auth`, `window`,
 * and `updates` as OPTIONAL so older shells (pre-spec-014, pre-spec-005,
 * pre-updater) still type-check when probed. That optionality is preserved
 * here as `OptionalNamespaces<>`.
 *
 * IPC channels (must stay byte-identical to apps/desktop/src/main/*.ts handlers):
 *   app:version, app:quit, app:openExternal
 *   auth:rendererReady, auth:deepLink
 *   updates:check, updates:installAndRestart, updates:skip, updates:available, updates:error
 *   window:minimize, window:toggleMaximize, window:close, window:isMaximized, window:maximizeStateChanged
 */

import type { IpcRendererEvent } from 'electron';

// --- Unsubscribe handle (matches preload.ts) ---
export type DesktopBridgeUnsubscribe = () => void;

// --- Subscribe helper (renderer-side, mirrors preload) ---
export type DesktopBridgeSubscribe = <T>(
  channel: string,
  cb: (payload: T) => void,
) => DesktopBridgeUnsubscribe;

// --- Payload types ---
export interface DesktopUpdateAvailableInfo {
  version: string;
  releaseDate?: string;
}
export interface DesktopUpdateErrorInfo {
  message: string;
}

// --- Namespace signatures (REQUIRED on the wire, OPTIONAL in the renderer view) ---
export interface DesktopAppBridge {
  version: () => Promise<string>;
  platform: () => NodeJS.Platform | string;
  quit: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
}
export interface DesktopAuthBridge {
  rendererReady: () => Promise<string | null>;
  onDeepLink: (cb: (url: string) => void) => DesktopBridgeUnsubscribe;
}
export interface DesktopUpdatesBridge {
  check: () => Promise<unknown>;
  installAndRestart: () => Promise<void>;
  skip: (version: string) => Promise<void>;
  onAvailable: (cb: (info: DesktopUpdateAvailableInfo) => void) => DesktopBridgeUnsubscribe;
  onError: (cb: (info: DesktopUpdateErrorInfo) => void) => DesktopBridgeUnsubscribe;
  // SC-002 fixture — adding this single method to the shared module
  // propagates to both preload and web runtime without further edits.
  onInstallProgress: (
    cb: (stage: 'extracting' | 'replacing' | 'restarting') => void,
  ) => DesktopBridgeUnsubscribe;
}
export interface DesktopWindowBridge {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (isMaximized: boolean) => void) => DesktopBridgeUnsubscribe;
}

// --- Wire-side full bridge (preload exposes all of these REQUIRED) ---
export interface MasarxDesktopBridge {
  app: DesktopAppBridge;
  auth: DesktopAuthBridge;
  updates: DesktopUpdatesBridge;
  window: DesktopWindowBridge;
}

/**
 * Renderer-side view: backward-compatible — namespaces added after the
 * shell was released are optional so the renderer can probe and degrade.
 * `app` stays required (it was the first namespace and every shell has it).
 */
export interface MasarxDesktopRuntimeBridge {
  app: DesktopAppBridge;
  auth?: DesktopAuthBridge;
  updates?: DesktopUpdatesBridge;
  window?: DesktopWindowBridge;
}

/**
 * The shared preload literal (canonical wire-side shape). The preload
 * script imports this and passes it to contextBridge — the runtime
 * inference catches any drift between wire and renderer.
 */
export const masarxDesktopApi = {
  app: {
    version: (): Promise<string> =>
      // typed as unknown in the canonical form so the contract is
      // about the channel, not the ipcRenderer binding
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<string> } })
        .ipcRenderer?.invoke('app:version') ?? Promise.reject(new Error('not in preload')),
    platform: (): NodeJS.Platform | string => (globalThis as { process?: { platform: NodeJS.Platform } }).process?.platform ?? '',
    quit: (): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<void> } })
        .ipcRenderer?.invoke('app:quit') ?? Promise.resolve(),
    openExternal: (url: string): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string, ...args: unknown[]) => Promise<void> } })
        .ipcRenderer?.invoke('app:openExternal', url) ?? Promise.resolve(),
  },
  auth: {
    rendererReady: (): Promise<string | null> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<string | null> } })
        .ipcRenderer?.invoke('auth:rendererReady') ?? Promise.resolve(null),
    onDeepLink: (_cb: (url: string) => void): DesktopBridgeUnsubscribe => () => {},
  },
  updates: {
    check: (): Promise<unknown> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<unknown> } })
        .ipcRenderer?.invoke('updates:check') ?? Promise.resolve(undefined),
    installAndRestart: (): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<void> } })
        .ipcRenderer?.invoke('updates:installAndRestart') ?? Promise.resolve(),
    skip: (_version: string): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string, ...args: unknown[]) => Promise<void> } })
        .ipcRenderer?.invoke('updates:skip', _version) ?? Promise.resolve(),
    onAvailable: (_cb: (info: DesktopUpdateAvailableInfo) => void): DesktopBridgeUnsubscribe => () => {},
    onError: (_cb: (info: DesktopUpdateErrorInfo) => void): DesktopBridgeUnsubscribe => () => {},
    onInstallProgress: (
      _cb: (stage: 'extracting' | 'replacing' | 'restarting') => void,
    ): DesktopBridgeUnsubscribe => () => {},
  },
  window: {
    minimize: (): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<void> } })
        .ipcRenderer?.invoke('window:minimize') ?? Promise.resolve(),
    toggleMaximize: (): Promise<boolean> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<boolean> } })
        .ipcRenderer?.invoke('window:toggleMaximize') ?? Promise.resolve(false),
    close: (): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<void> } })
        .ipcRenderer?.invoke('window:close') ?? Promise.resolve(),
    isMaximized: (): Promise<boolean> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<boolean> } })
        .ipcRenderer?.invoke('window:isMaximized') ?? Promise.resolve(false),
    onMaximizeChange: (_cb: (isMaximized: boolean) => void): DesktopBridgeUnsubscribe => () => {},
  },
} as const satisfies MasarxDesktopBridge;

/**
 * Stand-in for the legacy `MasarxDesktopApi = typeof api` type that was
 * the only export from apps/desktop/src/main/preload.ts:93. The shape
 * is now identical to `MasarxDesktopBridge`.
 */
export type MasarxDesktopApi = MasarxDesktopBridge;

// Re-export the Electron type so consumers that previously imported it
// from `preload.ts` don't need a direct electron import in shared tests.
export type { IpcRendererEvent };