import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
});
