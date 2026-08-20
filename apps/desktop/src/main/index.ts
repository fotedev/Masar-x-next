import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from './server.js';
import { LocalAuthSession, type StoredSession } from './auth-storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// index.ts — Electron main process entry point (T020)
//
// Responsibilities:
//   1. Decide dev vs prod via `app.isPackaged` (+ an explicit override env).
//   2. Start the local Next.js server (or honor an externally-running dev
//      server on MASARX_DESKTOP_PORT).
//   3. Wait for app.whenReady().
//   4. Open a BrowserWindow with secure webPreferences pointing at the
//      local server.
//   5. Wire the IPC handlers that preload.ts invokes.
//
// T021: `auth:*` IPC channels round-trip a `StoredSession` through
// `LocalAuthSession` (an encrypted file in `userData/auth/session.bin`,
// encrypted via `safeStorage`). The renderer holds the supabase client
// and persists via `auth:setSession`; `auth:changed` is broadcast on
// every write/clear for multi-window sync (v1 has a single window; the
// channel is in place for v2).
//
// The contract (T017) asserts:
//   - `startMainProcess` is a named export
//   - It returns the port number (never 3000 in prod — that's the dev port)
//   - BrowserWindow is created with contextIsolation: true, nodeIntegration:
//     false, sandbox: true
//   - BrowserWindow.loadURL is called with `http://127.0.0.1:<port>`
// ============================================================================

export async function startMainProcess(): Promise<number> {
  const isPackaged = app.isPackaged;
  const forceDev = process.env.MASARX_DESKTOP_FORCE_DEV === '1';
  const isDev = !isPackaged || forceDev;

  // Start the local server BEFORE app.whenReady so that by the time the
  // window is created the URL is guaranteed reachable. This makes the
  // contract deterministic and removes any race between window load and
  // server boot.
  const userDataPath = app.getPath('userData');
  const running = await startLocalServer({ userDataPath, isPackaged, forceDev });

  await app.whenReady();

  const preloadPath = path.join(__dirname, '../preload.js');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: !isDev, // dev mode can be hidden for faster iteration
    title: 'Masar X',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true, // T017 assertion
      nodeIntegration: false, // T017 assertion
      sandbox: true, // T017 assertion
      webSecurity: true,
      // Disable the spell checker; the renderer provides its own
      // multilingual spellcheck via the web app's existing components.
      spellcheck: false,
    },
  });

  win.loadURL(`http://127.0.0.1:${running.port}`);

  // T021 — LocalAuthSession IPC wiring.
  // Constructed AFTER app.whenReady so safeStorage is initialized on
  // all platforms (especially Windows, where DPAPI needs the app event
  // loop to be running).
  const authStorage = new LocalAuthSession({ userDataPath });

  ipcMain.handle('auth:getSession', () => authStorage.read());
  ipcMain.handle('auth:setSession', (_event, session: StoredSession) =>
    authStorage.write(session),
  );
  ipcMain.handle('auth:signOut', () => authStorage.clear());

  // Broadcast auth changes to all renderers. v1 has a single window;
  // the channel is wired so v2 multi-window just works.
  authStorage.onChange((session) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('auth:changed', session);
    }
  });

  // Smoke-test hook: when launched with `electron . --masarx-smoke`, the
  // app prints the chosen port to stdout and stays alive long enough for
  // the smoke test to probe it. See __tests__/smoke.test.ts (T018).
  if (process.env.MASARX_SMOKE === '1') {
    process.stdout.write(`MASARX_DESKTOP_PORT=${running.port}\n`);
  }

  // Quit when the last window closes (standard desktop UX).
  app.on('window-all-closed', () => {
    void running.stop().finally(() => {
      if (process.platform !== 'darwin') app.quit();
    });
  });

  return running.port;
}

// Auto-start when this file is the Electron main process. The `versions.electron`
// check makes the import side-effect-free under Vitest, so the T017 contract
// test can `import('../index')` and call `startMainProcess()` explicitly
// without the auto-start kicking in.
if (process.versions && process.versions.electron) {
  startMainProcess().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[masarx-desktop] Failed to start:', err);
    app.quit();
  });
}
