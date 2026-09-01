import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// T017 — Contract test for the Electron main process
// Spec: specs/004-multi-platform-expansion/tasks.md §T017
//
// This test defines the contract that `apps/desktop/src/main/index.ts` must
// satisfy. It is written FIRST (TDD red phase). It MUST fail until T020
// implements the main process.
//
// The contract has three assertions:
//   1. The main module exports a `startMainProcess` function.
//   2. `startMainProcess` starts a local Next.js server on a random free
//      port (not a hardcoded 3000 — collision-free with apps/web dev).
//   3. `startMainProcess` opens a `BrowserWindow` whose URL points at the
//      local server (`http://127.0.0.1:<port>`), with secure webPreferences
//      (contextIsolation: true, nodeIntegration: false, sandbox: true).
// ============================================================================

const mockLoadURL = vi.fn();
const mockBrowserWindowInstance = {
  loadURL: mockLoadURL,
  on: vi.fn(),
  // T025 follow-up: the production did-fail-load handler guards the
  // setTimeout callback with `win.isDestroyed()`. The retry tests below
  // invoke the handler manually, so the guard must be stubbed — otherwise
  // the timer fires an uncaught TypeError that masks the assertion.
  isDestroyed: vi.fn(() => false),
  webContents: { on: vi.fn(), send: vi.fn() },
};

const BrowserWindowMock = vi.fn().mockImplementation(() => mockBrowserWindowInstance);
(BrowserWindowMock as any).getAllWindows = vi.fn().mockReturnValue([]);

const mockApp = {
  whenReady: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  quit: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  getPath: vi.fn().mockReturnValue('/tmp/test-userData'),
  // isPackaged=true forces the production path in startMainProcess so the
  // test exercises findFreePort (returns 41234) instead of the dev
  // MASARX_DESKTOP_PORT fallback (3000). The contract is that prod
  // never uses a hardcoded port.
  isPackaged: true,
};

const mockIpcMain = {
  on: vi.fn(),
  handle: vi.fn(),
  removeHandler: vi.fn(),
};

vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: BrowserWindowMock,
  ipcMain: mockIpcMain,
  // T021 — LocalAuthSession requires `safeStorage` at construction.
  // The T017 contract is about main-process startup (port, window,
  // webPreferences); auth is out of scope, so we stub a no-op
  // "available" response. The T021 contract test exercises the
  // real safeStorage path in `auth-storage.test.ts`.
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'unknown',
    encryptStringAsync: vi.fn(async (plaintext: string) =>
      Buffer.from(plaintext, 'utf8'),
    ),
    decryptStringAsync: vi.fn(async (buf: Buffer) => ({
      result: buf.toString('utf8'),
      shouldReEncrypt: false,
    })),
  },
  // T024 — `index.ts` imports `buildAppMenu` from `./menu.js`, which
  // uses `Menu.buildFromTemplate` and `shell.openExternal` at
  // module-load time. The T017 contract is about Electron startup,
  // not the menu; stub both with no-op surfaces. The T024 contract
  // test exercises the real `buildAppMenu` in `menu.test.ts`.
  Menu: {
    buildFromTemplate: vi.fn(() => ({ items: [] })),
    setApplicationMenu: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(async () => undefined),
  },
}));

// Mock `next` start so the test does not actually spawn a Next.js server.
const mockNextPrepare = vi.fn().mockResolvedValue(undefined);
const mockNextGetRequestHandler = vi.fn().mockReturnValue(vi.fn());
const mockNextStart = vi.fn().mockResolvedValue(undefined);
const mockNextHandler = Object.assign(vi.fn(), {
  prepare: mockNextPrepare,
  getRequestHandler: mockNextGetRequestHandler,
  start: mockNextStart,
});
const NextMock = vi.fn().mockImplementation(() => mockNextHandler);

vi.mock('next', () => ({
  default: NextMock,
}));

// Mock net so we can stub the find-free-port path. The mockServer is
// declared at module scope and reused across calls (and across `clearAllMocks`
// in beforeEach, which clears call history but preserves the function
// reference, so the createServer vi.fn() always returns the same object).
const mockServer = {
  listen: vi.fn().mockImplementation((port: number, _host: string, cb: () => void) => {
    cb();
  }),
  address: vi.fn().mockReturnValue({ port: 41234, address: '127.0.0.1' }),
  close: vi.fn().mockImplementation((cb?: () => void) => {
    if (cb) cb();
  }),
  unref: vi.fn(),
  on: vi.fn(),
};

vi.mock('node:net', () => ({
  createServer: vi.fn(() => mockServer),
}));

const mockHttpListen = vi.fn().mockImplementation((_req: unknown, res: any) => {
  res.statusCode = 200;
  res.end('ok');
});
// Mock `node:http` (the same specifier server.ts uses) so the
// createServer() in the production path returns a server whose listen()
// invokes the callback synchronously. Includes `once` and `removeListener`
// for the EventEmitter surface the production code touches.
vi.mock('node:http', () => ({
  default: {
    createServer: vi.fn().mockReturnValue({
      listen: vi.fn().mockImplementation((port: number, _host: string, cb: () => void) => {
        cb();
        return {
          address: vi.fn().mockReturnValue({ port, address: '127.0.0.1' }),
          close: vi.fn(),
        };
      }),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
    }),
  },
}));

// T020.2 — server.ts now spawns the Next.js standalone server.js as a
// child process. The T017 contract test exercises startLocalServer in
// isPackaged=true mode, which calls startProductionServer → spawn().
// We stub spawn() so the test doesn't actually exec node. The returned
// child stays "alive" (exitCode: null) past the 500ms early-error
// window in startProductionServer, so the function returns {port} and
// the BrowserWindow assertions can run.
const mockChildProcess = {
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  kill: vi.fn(),
  exitCode: null,
  pid: 99999,
};
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockChildProcess),
  default: { spawn: vi.fn(() => mockChildProcess) },
}));

// T022 — `index.ts` now imports `LocalReadCache` which loads
// `better-sqlite3` at module-load time. The T017 contract is about
// the Electron main process startup (port, window, webPreferences);
// the read-cache wiring is out of scope, so we mock the native
// module entirely. The T022 contract test exercises the real
// better-sqlite3 path in `read-cache.test.ts`.
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(() => ({ changes: 0 })),
    })),
    close: vi.fn(),
  })),
}));

// T023 — `index.ts` now imports `Updater` from `electron-updater`.
// The T017 contract is about Electron startup; auto-update is out
// of scope, so we stub the module with a no-op surface. The T023
// contract test exercises the real Updater class in
// `updater.test.ts`.
//
// electron-updater is a CJS module; the production code accesses
// `autoUpdater` via the default export (see updater.ts). We mirror
// that shape here so the mock matches what vitest's loader expects.
vi.mock('electron-updater', () => {
  const autoUpdaterMock = {
    on: vi.fn(),
    checkForUpdates: vi.fn(async () => null),
    downloadUpdate: vi.fn(async () => []),
    quitAndInstall: vi.fn(),
    install: vi.fn(),
    skipUpdateCallback: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false,
  };
  const moduleExports = { autoUpdater: autoUpdaterMock };
  return {
    ...moduleExports,
    default: moduleExports,
  };
});

// T020.2 — server.ts reads process.resourcesPath to find the packaged
// standalone tree at <resourcesPath>/web/apps/web/server.js. In the
// test environment (no Electron), process.resourcesPath is undefined,
// which makes startProductionServer throw ENOENT before it can return
// a port. We create a real temp dir tree that mirrors the packaged
// layout and point process.resourcesPath at its root, so the fs.access
// check passes and the function proceeds to spawn() (mocked) and
// return a port for the BrowserWindow assertions to verify.
let tmpUserDataDir: string;
let tmpResourcesDir: string;

beforeAll(() => {
  tmpUserDataDir = mkdtempSync(path.join(os.tmpdir(), 'masarx-test-userdata-'));
  tmpResourcesDir = mkdtempSync(path.join(os.tmpdir(), 'masarx-test-resources-'));
  const webAppDir = path.join(tmpResourcesDir, 'web', 'apps', 'web');
  mkdirSync(webAppDir, { recursive: true });
  writeFileSync(path.join(webAppDir, 'server.js'), '// test stub\n', 'utf8');
  Object.defineProperty(process, 'resourcesPath', {
    value: tmpResourcesDir,
    configurable: true,
    writable: true,
  });
  // writePortSidecar writes port.json into userData; point app.getPath
  // at a real tmpdir so the write succeeds.
  mockApp.getPath = vi.fn().mockReturnValue(tmpUserDataDir);
});

afterAll(() => {
  if (tmpUserDataDir) rmSync(tmpUserDataDir, { recursive: true, force: true });
  if (tmpResourcesDir) rmSync(tmpResourcesDir, { recursive: true, force: true });
});

describe('T017 — Electron main process contract', () => {
  beforeEach(() => {
    // NOTE: do NOT use vi.clearAllMocks() here. In Vitest 2.x, clearAllMocks
    // appears to reset mockImplementation on vi.fn() instances stored in
    // module-scope objects (like our `mockServer` for `node:net`), which
    // breaks the listen-callback contract. The mocks are designed to be
    // stable across tests; if you need a per-test reset, re-establish the
    // mockImplementation explicitly here.
    BrowserWindowMock.mockImplementation(() => mockBrowserWindowInstance);
    (BrowserWindowMock as any).getAllWindows = vi.fn().mockReturnValue([]);
    NextMock.mockImplementation(() => mockNextHandler);
  });

  it('exports a startMainProcess function (red until T020)', async () => {
    const mod = await import('../index');
    expect(typeof (mod as any).startMainProcess).toBe('function');
  });

  it('starts a local Next.js server on a free port (not hardcoded 3000)', async () => {
    const mod = await import('../index');
    const port = await (mod as any).startMainProcess();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
    // Per data-model.md: the desktop app uses a free port negotiated at
    // startup so it does not collide with apps/web dev (port 3000).
    expect(port).not.toBe(3000);
  });

  it('opens a BrowserWindow pointing at the local server with secure webPreferences', async () => {
    const mod = await import('../index');
    const port = await (mod as any).startMainProcess();

    expect(BrowserWindowMock).toHaveBeenCalled();
    const lastOpts = BrowserWindowMock.mock.calls[BrowserWindowMock.mock.calls.length - 1][0];
    expect(lastOpts).toMatchObject({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    expect(mockLoadURL).toHaveBeenCalledWith(`http://127.0.0.1:${port}`);
  });

  // T025 follow-up: the BrowserWindow `did-fail-load` handler must retry
  // on transient local-server startup errors. The original implementation
  // only covered -102 (ERR_CONNECTION_REFUSED) and -105 (ERR_NAME_NOT_RESOLVED).
  // After the localhost-aware CSP fix in apps/web/src/middleware.ts, -107
  // (ERR_SSL_PROTOCOL_ERROR) is the third error code a stale ServiceWorker
  // or transient CSP can produce; the desktop should self-heal by retrying
  // the loadURL 500ms later.
  it.each([-102, -105, -107])(
    'retries loadURL on did-fail-load error %i',
    async (errorCode) => {
      const mod = await import('../index');
      await (mod as any).startMainProcess();

      // The handler is registered on `webContents.on('did-fail-load', …)`
      // (see apps/desktop/src/main/index.ts). The mock exposes the
      // `on` calls on `mockBrowserWindowInstance.webContents.on`.
      const webContentsOn = (mockBrowserWindowInstance as any).webContents.on;
      const handler = webContentsOn.mock.calls.find(
        (c: any[]) => c[0] === 'did-fail-load',
      )?.[1];
      expect(handler, 'did-fail-load handler should be registered').toBeTruthy();

      const before = mockLoadURL.mock.calls.length;
      handler({}, errorCode, 'simulated error');
      // Allow the 500ms backoff to elapse.
      await new Promise((r) => setTimeout(r, 600));
      const after = mockLoadURL.mock.calls.length;

      expect(after, 'loadURL should be called again after the retry backoff').toBeGreaterThan(before);
      // The retry URL must be plain HTTP on the loopback port (defense in
      // depth: even if the CSP regresses, the retry should not be HTTPS).
      const lastCall = mockLoadURL.mock.calls[mockLoadURL.mock.calls.length - 1];
      expect(lastCall[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    },
  );
});
