import { app, BrowserWindow, ipcMain, Menu, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from './server.js';
import { LocalAuthSession, type StoredSession } from './auth-storage.js';
import { LocalReadCache } from './read-cache.js';
import { Updater, bootUpdater } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the window icon path for both dev and packaged builds.
// - Dev:       apps/desktop/src/main/index.ts → ../../build/icon.ico
//              (resolves to apps/desktop/build/icon.ico in the source tree)
// - Packaged:  build/icon.ico is shipped as an extraResource (see
//              electron-builder.yml `extraResources`); the path is
//              ${resourcesPath}/build/icon.ico.
// On Windows, the EXE icon (set via electron-builder `win.icon`) is used
// by Explorer/Task Manager regardless. This `icon` option drives the
// window's title-bar/Alt-Tab icon — critical on macOS/Linux and in dev.
const WINDOW_ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'build', 'icon.ico')
  : path.join(__dirname, '../../build/icon.ico');

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

  // T024 superseded by US3 (T040–T043). Strip the native menu bar
  // (File / Edit / View / Window / Help) BEFORE creating the window:
  // on Windows Electron attaches the default application menu at
  // BrowserWindow construction, so calling this afterwards leaves a
  // visible bar on the first paint. The T024 "Check for Updates…"
  // trigger stays available through the `updates:check` IPC.
  Menu.setApplicationMenu(null);

  // Pin Accept-Language to Arabic (with English fallback) so the bundled
  // Next.js app's `localeDetection: true` (apps/web/src/i18n/routing.ts)
  // auto-redirects the BrowserWindow's first request to /ar instead of
  // falling back to the Chromium default (English). Masar X is an
  // Arabic-first product; the web path also benefits because visitors
  // who haven't picked a locale yet land on the Arabic home page.
  //
  // `onBeforeSendHeaders` runs at the network layer for the default
  // session, so it applies to every request the BrowserWindow makes
  // (HTML, XHR, RSC, asset fetches). Setting the header on the request
  // rather than via `BrowserWindow.webPreferences.locale` (which only
  // affects navigator.language) is what next-intl's middleware reads.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'Accept-Language': 'ar-EG,ar;q=0.95,en;q=0.8',
      },
    });
  });

  // Preload lives in the same directory as index.js after `tsc -p
  // tsconfig.build.json` (both are under dist/main/). The earlier
  // `../preload.js` form only worked when index.js was compiled to
  // dist/ with the preload at dist/preload.js; that layout was never
  // the case for the current tsconfig (rootDir: src, outDir: dist),
  // so the renderer was getting `window.masarxDesktop === undefined`
  // in every packaged build. Surfaced by T025; fixed in T020.1.
  const preloadPath = path.join(__dirname, './preload.js');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: !isDev, // dev mode can be hidden for faster iteration
    title: 'Masar X',
    icon: WINDOW_ICON_PATH,
    // T040–T043 (spec 005 US3): frameless shell — `CustomTitlebar.tsx`
    // owns the chrome, so we strip both the OS frame and the hidden
    // overlay adornments. The `titleBarOverlay: false` keeps control of
    // hover/click regions fully with the renderer (no surprises at the
    // ends of the drag strip). `autoHideMenuBar` is belt-and-suspenders
    // for the rare Windows path where a default menu still attaches.
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    autoHideMenuBar: true,
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

  // Per-window menu removal. `setApplicationMenu(null)` above is the
  // app-wide switch; `setMenu(null)` is the Windows/Linux per-window
  // equivalent and is what actually hides the bar on those platforms
  // when a default menu slipped through construction.
  win.setMenu(null);

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    // Retry transient local-server startup errors:
    //   -102 ERR_CONNECTION_REFUSED  — Next.js standalone server not yet bound
    //   -105 ERR_NAME_NOT_RESOLVED    — DNS race during launch
    //   -107 ERR_SSL_PROTOCOL_ERROR   — defense-in-depth: if a stale CSP or
    //                                    ServiceWorker re-introduces HTTPS to
    //                                    the loopback host, the retry will
    //                                    land on plain HTTP and the page will
    //                                    render. The actual fix lives in
    //                                    apps/web/src/proxy.ts (the
    //                                    CSP drops upgrade-insecure-requests
    //                                    for 127.0.0.1/localhost).
    if (errorCode === -102 || errorCode === -105 || errorCode === -107) {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          void win.loadURL(`http://127.0.0.1:${running.port}`);
        }
      }, 500);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[masarx-desktop] Window failed to load: ${errorDescription} (${errorCode})`);
    }
  });

  win.loadURL(`http://127.0.0.1:${running.port}`);

  // T040–T042 (spec 005 US3): window-control IPC surface exposed to the
  // renderer through `masarxDesktop.window` (see apps/desktop/src/main/preload.ts).
  // Every handler is a thin wrapper around BrowserWindow + a single state
  // query. The IPC names match the contract in
  // apps/web/src/lib/desktop/runtime.ts exactly so the renderer never has
  // to know the implementation detail behind each call.
  //
  // The maximize-state broadcast channel (`window:maximizeStateChanged`)
  // is consumed by the renderer's `CustomTitlebar.tsx` to flip the
  // button glyph between maximize/restore. It fires on every transition
  // including the initial state so subscribers that mount late do not
  // observe a stale "isMaximized=false" while the window is actually
  // fullscreen.
  ipcMain.handle('window:minimize', () => {
    win.minimize();
  });
  ipcMain.handle('window:toggleMaximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });
  ipcMain.handle('window:close', () => {
    win.close();
  });
  ipcMain.handle('window:isMaximized', () => win.isMaximized());

  win.on('maximize', () => {
    win.webContents.send('window:maximizeStateChanged', true);
  });
  win.on('unmaximize', () => {
    win.webContents.send('window:maximizeStateChanged', false);
  });

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

  // T022 — LocalReadCache IPC wiring.
  // SQLite cache for read-through Supabase queries. The renderer
  // owns the read-through policy; main is just storage.
  const readCache = new LocalReadCache({ userDataPath });

  ipcMain.handle('cache:get', (_event, key: string) => readCache.get(key));
  ipcMain.handle(
    'cache:set',
    (_event, key: string, value: unknown, opts?: { ttlMs?: number; entity?: string }) =>
      readCache.set(key, value, opts),
  );
  ipcMain.handle('cache:delete', (_event, key: string) => readCache.delete(key));

  // Prune timer — every 1h, drop entries past their grace period.
  // `unref()` so the timer doesn't keep the app alive at quit.
  const pruneTimer = setInterval(() => {
    try {
      readCache.prune();
    } catch {
      // Prune failures are non-fatal; the next tick will retry.
    }
  }, 60 * 60 * 1000);
  pruneTimer.unref();

  app.on('before-quit', () => {
    clearInterval(pruneTimer);
    readCache.close();
  });

  // T023 — auto-update wiring.
  // The Updater class wraps electron-updater; bootUpdater() wires the
  // available/progress/error events to broadcasts on `updates:*`
  // channels (handled by preload.ts and the renderer's updates.* API).
  const updater = new Updater({ userDataPath });
  bootUpdater({
    updater,
    broadcast: (channel, payload) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send(channel, payload);
      }
    },
  });
  ipcMain.handle('updates:check', () => updater.checkFor());
  ipcMain.handle('updates:installAndRestart', () => updater.installAndRestart());
  ipcMain.handle('updates:skip', (_event, version: string) =>
    updater.skipThisVersion(version),
  );

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
