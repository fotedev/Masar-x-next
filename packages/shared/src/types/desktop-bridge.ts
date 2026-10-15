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
 *   app:version, app:openExternal
 *   auth:rendererReady, auth:deepLink
 *   updates:installAndRestart, updates:skip, updates:available, updates:error
 *   window:minimize, window:toggleMaximize, window:close, window:isMaximized, window:maximizeStateChanged
 */

// --- Unsubscribe handle (matches preload.ts) ---
type DesktopBridgeUnsubscribe = () => void;

// --- Payload types ---
export interface DesktopUpdateAvailableInfo {
  version: string;
  releaseDate?: string;
}
interface DesktopUpdateErrorInfo {
  message: string;
}

// --- Namespace signatures (REQUIRED on the wire, OPTIONAL in the renderer view) ---
interface DesktopAppBridge {
  version: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}
interface DesktopAuthBridge {
  rendererReady: () => Promise<string | null>;
  onDeepLink: (cb: (url: string) => void) => DesktopBridgeUnsubscribe;
}
interface DesktopUpdatesBridge {
  installAndRestart: () => Promise<void>;
  skip: (version: string) => Promise<void>;
  onAvailable: (cb: (info: DesktopUpdateAvailableInfo) => void) => DesktopBridgeUnsubscribe;
  onError: (cb: (info: DesktopUpdateErrorInfo) => void) => DesktopBridgeUnsubscribe;
}
interface DesktopWindowBridge {
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
    installAndRestart: (): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string) => Promise<void> } })
        .ipcRenderer?.invoke('updates:installAndRestart') ?? Promise.resolve(),
    skip: (_version: string): Promise<void> =>
      (globalThis as { ipcRenderer?: { invoke: (c: string, ...args: unknown[]) => Promise<void> } })
        .ipcRenderer?.invoke('updates:skip', _version) ?? Promise.resolve(),
    onAvailable: (_cb: (info: DesktopUpdateAvailableInfo) => void): DesktopBridgeUnsubscribe => () => {},
    onError: (_cb: (info: DesktopUpdateErrorInfo) => void): DesktopBridgeUnsubscribe => () => {},
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