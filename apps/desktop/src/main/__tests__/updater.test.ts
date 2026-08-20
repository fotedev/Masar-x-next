import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// T023 — Contract test for Updater (updater.ts)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T023
// Research: specs/004-multi-platform-expansion/research.md §6
// Data: specs/004-multi-platform-expansion/data-model.md
//
// This test defines the contract that `apps/desktop/src/main/updater.ts`
// must satisfy. It is written FIRST (TDD red phase). It MUST fail until T023
// implements the Updater class.
//
// The contract has six assertions:
//   1. checkOnStartup() calls autoUpdater.checkForUpdates() once.
//   2. autoUpdater 'update-available' triggers onAvailable subscribers.
//   3. autoUpdater 'update-downloaded' writes the pending-update flag.
//   4. skipThisVersion(v) calls autoUpdater.skipUpdateCallback.
//   5. installAndRestart() calls autoUpdater.quitAndInstall()
//      (quitAndInstall itself handles app.quit() internally —
//      we do NOT call app.quit() separately).
//   6. A stale pending-update.json at startup triggers the rollback path.
//
// The Updater class accepts an injected `autoUpdater` for tests so
// the contract is verifiable without a real release feed.
// ============================================================================

// --- autoUpdater mock state --------------------------------------------------
// We model the electron-updater autoUpdater surface we use. Tests drive
// behavior by calling `__emitter.emit('update-available', { ... })` and
// asserting on the spy functions below.

type UpdaterEvents = {
  'update-available': [{ version: string; releaseDate?: string }];
  'update-downloaded': [{ version: string; releaseDate?: string }];
  error: [Error];
  'download-progress': [{ percent: number }];
};

interface MockAutoUpdater {
  checkForUpdates: ReturnType<typeof vi.fn>;
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
  skipUpdateCallback: ReturnType<typeof vi.fn>;
  install: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  // Internal: emitter so tests can simulate events
  __emitter: {
    emit<K extends keyof UpdaterEvents>(event: K, ...args: UpdaterEvents[K]): void;
  };
}

let autoUpdaterMock: MockAutoUpdater;

vi.mock('electron-updater', () => {
  // Build the mock inside the factory so vi.resetModules() between tests
  // doesn't lose state. The factory runs once per module load.
  const handlers: { [K in keyof UpdaterEvents]?: Array<(...args: any[]) => void> } = {};

  const on = vi.fn((event: keyof UpdaterEvents, cb: (...args: any[]) => void) => {
    handlers[event] = handlers[event] || [];
    handlers[event]!.push(cb);
    return () => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
    };
  });

  const reset = () => {
    for (const key of Object.keys(handlers) as Array<keyof UpdaterEvents>) {
      delete handlers[key];
    }
  };

  return {
    autoUpdater: {
      checkForUpdates: vi.fn(async () => null),
      downloadUpdate: vi.fn(async () => ['/path/to/update.exe']),
      quitAndInstall: vi.fn(),
      skipUpdateCallback: vi.fn(),
      install: vi.fn(),
      on,
      autoDownload: false,
      autoInstallOnAppQuit: false,
      __emitter: {
        emit<K extends keyof UpdaterEvents>(event: K, ...args: UpdaterEvents[K]) {
          for (const h of handlers[event] || []) {
            h(...args);
          }
        },
      },
      __reset: reset,
    },
  };
});

// electron mock: app is referenced by Updater for app.quit() and app.getPath().
// We use a minimal mock — T017 already has the full shape; here we just need
// app.quit, app.getPath, and app.whenReady.
vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    whenReady: vi.fn(async () => undefined),
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return process.env.TMP_USER_DATA || '';
      return '';
    }),
    on: vi.fn(),
    isPackaged: false,
  },
}));

// Import AFTER mocks. Vitest hoists vi.mock() so this is safe.
import { Updater } from '../updater.js';
import { autoUpdater as importedAutoUpdater } from 'electron-updater';

// --- per-test temp dir --------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'masarx-updater-test-'));
  process.env.TMP_USER_DATA = tmpDir;
  // Get a fresh reference to the mock. The import is shared across tests
  // (vi.resetModules is NOT used), so we reset call history here.
  autoUpdaterMock = importedAutoUpdater as unknown as MockAutoUpdater;
  // Clear all subscribed handlers so handlers from previous tests don't
  // leak into this one (this caused the "writes flag in wrong dir" bug).
  (autoUpdaterMock as unknown as { __reset: () => void }).__reset();
  autoUpdaterMock.checkForUpdates.mockClear();
  autoUpdaterMock.downloadUpdate.mockClear();
  autoUpdaterMock.quitAndInstall.mockClear();
  autoUpdaterMock.skipUpdateCallback.mockClear();
  autoUpdaterMock.install.mockClear();
  autoUpdaterMock.on.mockClear();
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  delete process.env.TMP_USER_DATA;
});

// --- tests --------------------------------------------------------------------

describe('T023 — Updater contract', () => {
  it('checkOnStartup calls autoUpdater.checkForUpdates', async () => {
    const updater = new Updater({ userDataPath: tmpDir });
    await updater.checkOnStartup();
    expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('emits onAvailable when autoUpdater fires update-available', async () => {
    const updater = new Updater({ userDataPath: tmpDir });
    const seen: Array<{ version: string }> = [];
    updater.onAvailable((info) => seen.push(info));

    autoUpdaterMock.__emitter.emit('update-available', { version: '0.6.0' });

    expect(seen).toEqual([{ version: '0.6.0' }]);
  });

  it('writes the pending-update flag on update-downloaded', async () => {
    const updater = new Updater({ userDataPath: tmpDir });
    // Trigger the wired event handlers by calling checkOnStartup (which
    // calls on() for the autoUpdater events).
    await updater.checkOnStartup();

    autoUpdaterMock.__emitter.emit('update-downloaded', { version: '0.6.0' });
    // The 'update-downloaded' handler kicks off an async writeFile; wait
    // for the file to exist AND have content (writeFile may create an
    // empty file before the write completes).
    const flagPath = path.join(tmpDir, 'pending-update.json');
    await vi.waitFor(
      () => {
        const exists = existsSync(flagPath);
        const hasContent = exists && readFileSync(flagPath, 'utf8').length > 0;
        expect(hasContent).toBe(true);
      },
      { timeout: 1000 },
    );

    const flag = JSON.parse(readFileSync(flagPath, 'utf8'));
    expect(flag.version).toBe('0.6.0');
    expect(typeof flag.appliedAt).toBe('number');
  });

  it('skipThisVersion calls autoUpdater.skipUpdateCallback', () => {
    const updater = new Updater({ userDataPath: tmpDir });
    updater.skipThisVersion('0.6.0');
    expect(autoUpdaterMock.skipUpdateCallback).toHaveBeenCalledWith(
      expect.objectContaining({ releaseName: '0.6.0' }),
    );
  });

  it('installAndRestart calls autoUpdater.quitAndInstall (which itself calls app.quit)', () => {
    const updater = new Updater({ userDataPath: tmpDir });
    updater.installAndRestart();
    // We do NOT call app.quit() ourselves — quitAndInstall handles that
    // (per electron-updater's documented behavior). Asserting ONLY on
    // quitAndInstall is correct.
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalled();
  });

  it('a stale pending-update flag at startup triggers the rollback path', async () => {
    // Pre-seed a stale flag (as if a previous update was applied but the
    // new version didn't run the 30s trial successfully).
    const flagPath = path.join(tmpDir, 'pending-update.json');
    writeFileSync(
      flagPath,
      JSON.stringify({ version: '0.6.0', appliedAt: Date.now() - 60_000 }),
      'utf8',
    );

    const updater = new Updater({ userDataPath: tmpDir });
    await updater.checkOnStartup();

    // The rollback path calls autoUpdater.install(force=true, silent=true)
    // and then clears the flag so we don't loop.
    expect(autoUpdaterMock.install).toHaveBeenCalledWith(true, true);
    expect(existsSync(flagPath)).toBe(false);
  });
});
