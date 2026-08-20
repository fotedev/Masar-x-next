import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// ============================================================================
// preload.ts — runs in an isolated world with Node access, but the renderer's
// `window` only sees the surface we explicitly expose via contextBridge.
//
// Contract (T020):
//   - `window.masarxDesktop.auth.*`    — session reads / sign-out / change events
//   - `window.masarxDesktop.cache.*`   — local SQLite read-through (T022)
//   - `window.masarxDesktop.app.*`     — app version, platform, controlled quit
//   - `window.masarxDesktop.updates.*` — auto-update surface (T023)
//
// Security posture:
//   - contextIsolation is on (enforced by BrowserWindow webPreferences).
//   - nodeIntegration is off; the renderer is plain Chromium.
//   - The renderer can only `invoke` handlers we register in main via
//     ipcMain.handle. The renderer cannot reach the file system, network,
//     or any other Node API directly.
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
  auth: {
    getSession: (): Promise<unknown> => ipcRenderer.invoke('auth:getSession'),
    setSession: (session: unknown): Promise<void> =>
      ipcRenderer.invoke('auth:setSession', session),
    signOut: (): Promise<void> => ipcRenderer.invoke('auth:signOut'),
    onChange: (cb: (event: unknown) => void): Unsubscribe =>
      subscribe<unknown>('auth:changed', cb),
  },
  cache: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke('cache:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('cache:set', key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('cache:delete', key),
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    platform: (): NodeJS.Platform => process.platform,
    quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  },
  updates: {
    check: (): Promise<unknown> => ipcRenderer.invoke('updates:check'),
    installAndRestart: (): Promise<void> =>
      ipcRenderer.invoke('updates:installAndRestart'),
    skip: (version: string): Promise<void> =>
      ipcRenderer.invoke('updates:skip', version),
    onAvailable: (cb: (info: unknown) => void): Unsubscribe =>
      subscribe<unknown>('updates:available', cb),
  },
} as const;

contextBridge.exposeInMainWorld('masarxDesktop', api);

export type MasarxDesktopApi = typeof api;
