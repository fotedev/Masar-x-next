import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
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

// R12 (audit 2026-09-08) — local recovery page rendered when the local
// Next.js server is unreachable after 3 retries. Self-contained, no
// external resources, no CSP dependencies. The Retry button re-attempts
// the loopback URL through main (which the page triggers via the
// preload bridge's `window:close` + `app:quit`-style pattern is overkill;
// instead we just reload the data: URL with the cached original URL
// embedded, and let main re-issue loadURL on the next did-fail-load).
function recoveryPageUrl(originalUrl: string, lastError: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Masar X — Local Server Unavailable</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; padding: 48px; background: #0b1220; color: #e6edf3; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { font-size: 14px; line-height: 1.5; color: #9ba8b6; max-width: 520px; }
  code { background: #1a2332; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  button { margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white;
           border: 0; border-radius: 6px; cursor: pointer; font-size: 14px; }
  button:hover { background: #1d4ed8; }
  small { color: #6b7785; display: block; margin-top: 24px; font-size: 12px; }
</style></head><body>
<h1>Local server is not responding</h1>
<p>The Masar X desktop shell could not reach its local server at <code>${safe(originalUrl)}</code> after 3 attempts. The last reported error was:</p>
<p><code>${safe(lastError)}</code></p>
<button onclick="window.location.reload()">Retry</button>
<small>If this keeps happening, quit and relaunch the app. The recovery page is rendered locally and does not require the server.</small>
</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

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

  // R10 (audit 2026-09-08) — single-instance lock. Second launches focus
  // the existing window instead of spawning a second server + updater.
  // The check must run before any expensive setup (server start, IPC
  // handler registration) so a duplicate process exits cheaply.
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    // eslint-disable-next-line no-console
    console.warn('[masarx-desktop] Another instance is already running; quitting.');
    app.quit();
    return 0;
  }
  // The listener is registered on the locked instance. When a second
  // copy launches, the OS re-routes the argv here and we surface the
  // existing window instead of opening a new one.
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows()[0];
    if (!existing) return;
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
  });

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
    //                                    apps/web/src/middleware.ts (the
    //                                    CSP drops upgrade-insecure-requests
    //                                    for 127.0.0.1/localhost).
    //
    // R12 (audit 2026-09-08) — cap the retry loop. The original code
    // retried forever every 500 ms; if the server never came up the
    // user saw an empty window with no error indication. After 3
    // attempts we surface a local error page with a Retry button that
    // re-pings the loopback URL (the page knows how to recover).
    if (errorCode === -102 || errorCode === -105 || errorCode === -107) {
      const maxRetries = 3;
      didFailLoadAttempts += 1;
      if (didFailLoadAttempts > maxRetries) {
        // eslint-disable-next-line no-console
        console.error(
          `[masarx-desktop] Local server unreachable after ${maxRetries} retries ` +
            `(last error: ${errorDescription} / ${errorCode}). Showing recovery page.`,
        );
        if (!win.isDestroyed()) {
          void win.loadURL(
            recoveryPageUrl(`http://127.0.0.1:${running.port}`, `${errorDescription} (${errorCode})`),
          );
        }
        return;
      }
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

  // Track did-fail-load attempts across retries. Counter resets on every
  // successful navigation, so a one-off transient error after a healthy
  // boot doesn't poison the retry budget.
  let didFailLoadAttempts = 0;
  win.webContents.on('did-finish-load', () => {
    didFailLoadAttempts = 0;
  });

  win.loadURL(`http://127.0.0.1:${running.port}`);

  // R5 (audit 2026-09-08) — webContents hardening. The workspace's
  // download button and the subject page's view-content handler both
  // call `window.open(url, "_blank")`. Without these guards the renderer
  // spawns raw Electron child windows (no shell chrome, no menu, full
  // web access — phishing-pattern surface). Pin everything to either the
  // loopback origin (in-app navigation) or the system browser (external).
  const allowedOrigin = `http://127.0.0.1:${running.port}`;

  // window.open: deny by default. http(s) URLs go to the system browser;
  // anything else (mailto:, javascript:, file:, etc.) is dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      // eslint-disable-next-line no-console
      console.info(`[masarx-desktop] Routing window.open to system browser: ${url}`);
      void shell.openExternal(url);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[masarx-desktop] Blocked window.open for non-http url: ${url}`);
    }
    return { action: 'deny' };
  });

  // will-navigate: pin top-level navigation to the loopback origin. Any
  // attempt to navigate the main window elsewhere (OAuth redirect, a
  // tampered <a target="_self">, a malicious script) is reverted. The
  // CustomTitlebar's back/menu affordances use the in-app router, which
  // is an SPA pushState and does NOT fire will-navigate, so this guard
  // does not break shell navigation.
  win.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith(allowedOrigin)) {
      event.preventDefault();
      // eslint-disable-next-line no-console
      console.warn(`[masarx-desktop] Blocked navigation to: ${navUrl}`);
    }
  });

  // Permission requests (camera, mic, geolocation, notifications, etc.).
  // The web app renders inside the shell and has no need for any of
  // these; deny by default to reduce the blast radius of an XSS.
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    // eslint-disable-next-line no-console
    console.warn(`[masarx-desktop] Denied permission request: ${_permission}`);
    callback(false);
  });

  // R14 (audit 2026-09-08) — preload/main parity. The preload bridge
  // exposes `masarxDesktop.app.version` and `masarxDesktop.app.quit`
  // (see apps/desktop/src/main/preload.ts). Without these handlers the
  // renderer gets `No handler registered` whenever a surface tries to
  // read the version or trigger a controlled quit.
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

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
