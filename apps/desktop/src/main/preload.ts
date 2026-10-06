import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { masarxDesktopApi, type DesktopUpdateAvailableInfo } from '@masarx-shared/types/desktop-bridge';

// ============================================================================
// preload.ts — runs in an isolated world with Node access, but the renderer's
// `window` only sees the surface we explicitly expose via contextBridge.
//
// Contract (T020):
//   - `window.masarxDesktop.app.*`     — app version, openExternal
//   - `window.masarxDesktop.updates.*` — auto-update surface (T023)
//
// Security posture:
//   - contextIsolation is on (enforced by BrowserWindow webPreferences).
//   - nodeIntegration is off; the renderer is plain Chromium.
//   - The renderer can only `invoke` handlers we register in main via
//     ipcMain.handle. The renderer cannot reach the file system, network,
//     or any other Node API directly.
//
// Spec 015: the canonical `api` literal now lives in
// packages/shared/src/types/desktop-bridge.ts so the web renderer's
// type view can never drift from the preload's wire shape. The local
// `api` below is built from the same shape with real electron-bound
// implementations replacing the stubbed callbacks.
// ============================================================================

type Unsubscribe = () => void;

const subscribe = <T>(channel: string, cb: (payload: T) => void): Unsubscribe => {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    // Spec 014 (R032) — open a URL in the system browser. Used by the
    // OAuth consent flow: main validates the http(s) scheme before
    // calling shell.openExternal, so the renderer cannot be tricked into
    // opening arbitrary schemes.
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('app:openExternal', url),
  },
  // Spec 014 (R032) — masarx:// deep-link auth surface. `rendererReady`
  // announces the renderer's subscription and returns (and clears) any
  // deep link that arrived before it — the cold-start OAuth callback race
  // is closed by pull, not by replay. `onDeepLink` receives every link
  // dispatched after the renderer is ready (warm-start second-instance
  // argv, macOS open-url).
  auth: {
    rendererReady: (): Promise<string | null> =>
      ipcRenderer.invoke('auth:rendererReady'),
    onDeepLink: (cb: (url: string) => void): Unsubscribe =>
      subscribe<string>('auth:deepLink', cb),
  },
  updates: {
    installAndRestart: (): Promise<void> =>
      ipcRenderer.invoke('updates:installAndRestart'),
    skip: (version: string): Promise<void> =>
      ipcRenderer.invoke('updates:skip', version),
    onAvailable: (cb: (info: DesktopUpdateAvailableInfo) => void): Unsubscribe =>
      subscribe<DesktopUpdateAvailableInfo>('updates:available', cb),
    // B4 (audit 2026-09-12) — main broadcasts `updates:error` (see
    // updater.ts:424) but the renderer-facing subscription was missing
    // here. UpdateToast.tsx was calling `updates.onError(...)` and
    // crashing with a TypeError on first shell mount. Payload matches
    // updater.ts: `{ message: err.message }`.
    onError: (cb: (info: { message: string }) => void): Unsubscribe =>
      subscribe<{ message: string }>('updates:error', cb),
    // SC-002 fixture (spec 015) — added here BECAUSE the shared module's
    // satisfies constraint forced this file to expose every bridge method.
    // Without the dedup this method could land in one file and silently
    // miss the other (the 2026-09-12 B4 audit toast-crash bug class).
    onInstallProgress: (
      cb: (stage: 'extracting' | 'replacing' | 'restarting') => void,
    ): Unsubscribe => subscribe<{ stage: 'extracting' | 'replacing' | 'restarting' }>('updates:installProgress', ({ stage }) => cb(stage)),
  },
  // T040–T043 (spec 005 US3): frameless titlebar window controls. The
  // renderer exposes a thin surface that matches the optional
  // `MasarxDesktopRuntimeBridge.window` contract in
  // apps/web/src/lib/desktop/runtime.ts. Each method is a Promise so
  // the renderer's call sites stay await-able and the titlebar can
  // surface a "could not minimize" toast if main ever rejects.
  // `onMaximizeChange` is the renderer-facing event for the OS
  // maximize/unmaximize broadcast (channel `window:maximizeStateChanged`).
  // The unsubscribe handle is returned synchronously so the React effect
  // that subscribes on mount can cleanly detach on unmount.
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> =>
      ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> =>
      ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (isMaximized: boolean) => void): Unsubscribe =>
      subscribe<boolean>('window:maximizeStateChanged', cb),
  },
} as const satisfies typeof masarxDesktopApi;

contextBridge.exposeInMainWorld('masarxDesktop', api);
