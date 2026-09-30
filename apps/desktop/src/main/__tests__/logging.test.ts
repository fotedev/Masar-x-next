import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// Spec 028 — Contract test for the diagnostics boot (logging.ts)
//
// Spec: specs/028-desktop-crashpad-logs/spec.md
//
// The contract has six assertions:
//   1. resolveDiagnosticsPaths derives logs/ + crashDumps/ under userData.
//   2. initLogging pins the file transport to userData/logs/main.log with
//      5 MB rotation and info levels on both transports.
//   3. initCrashReporting calls app.setPath('crashDumps', …) BEFORE
//      crashReporter.start, with uploadToServer: false and no submitURL
//      (local-only contract — no remote submission until the owner opts in).
//   4. registerProcessGoneHandlers registers render-process-gone +
//      child-process-gone; crashed reasons log at error level, clean exits
//      at info level.
//   5. initDiagnostics wires everything and logs a boot line naming BOTH
//      artifact paths (the field-support contract).
//   6. initDiagnostics degrades instead of throwing when the logs dir is
//      unwritable ("unconfigured ≠ crash", mirrors spec 023).
// ============================================================================

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'masarx-logging-test-userdata')),
    setPath: vi.fn(),
    on: vi.fn(),
  },
  crashReporter: { start: vi.fn() },
}));

vi.mock('electron-log/main', () => {
  const logStub: any = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    scope: vi.fn(() => logStub),
    transports: {
      file: { level: 'silly' as const, maxSize: 0, resolvePathFn: vi.fn() },
      console: { level: 'silly' as const },
    },
    errorHandler: { startCatching: vi.fn() },
  };
  return { default: logStub };
});

vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));

// Import AFTER mocks (same pattern as updater.test.ts).
import { app as mockedApp, crashReporter as mockedCrashReporter } from 'electron';
import { mkdirSync } from 'node:fs';
import log from 'electron-log/main';
import {
  resolveDiagnosticsPaths,
  logFilePath,
  initLogging,
  initCrashReporting,
  startCatchingProcessErrors,
  registerProcessGoneHandlers,
  initDiagnostics,
} from '../logging.js';

const mkdirMock = vi.mocked(mkdirSync);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveDiagnosticsPaths', () => {
  it('derives logs/ and crashDumps/ under the userData directory', () => {
    const paths = resolveDiagnosticsPaths(path.join('base', 'dir'));
    expect(paths.logsDir).toBe(path.join('base', 'dir', 'logs'));
    expect(paths.crashDumpsDir).toBe(path.join('base', 'dir', 'crashDumps'));
  });

  it('resolves the log file as logs/main.log', () => {
    const paths = resolveDiagnosticsPaths(path.join('base', 'dir'));
    expect(logFilePath(paths)).toBe(path.join('base', 'dir', 'logs', 'main.log'));
  });
});

describe('initLogging', () => {
  it('pins the file transport to userData/logs/main.log with 5 MB rotation', () => {
    const paths = resolveDiagnosticsPaths('/fake/userData');
    initLogging(paths);

    expect(log.transports.file.maxSize).toBe(5 * 1024 * 1024);
    expect(log.transports.file.level).toBe('info');
    expect(log.transports.console.level).toBe('info');
    const resolve = log.transports.file.resolvePathFn as unknown as () => string;
    expect(resolve()).toBe(logFilePath(paths));
  });
});

describe('initCrashReporting', () => {
  it('pins crashDumps then starts the reporter with uploadToServer: false', () => {
    const paths = resolveDiagnosticsPaths('/fake/userData');
    initCrashReporting(paths.crashDumpsDir);

    expect(mockedApp.setPath).toHaveBeenCalledWith('crashDumps', paths.crashDumpsDir);
    const startMock = vi.mocked(mockedCrashReporter.start);
    expect(startMock).toHaveBeenCalledTimes(1);

    const setPathOrder = (mockedApp.setPath as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const startOrder = startMock.mock.invocationCallOrder[0];
    expect(setPathOrder).toBeLessThan(startOrder);
  });

  it('never passes a submitURL (local-only contract)', () => {
    initCrashReporting('/fake/userData/crashDumps');
    const startMock = vi.mocked(mockedCrashReporter.start);
    const options = startMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.uploadToServer).toBe(false);
    expect(options).not.toHaveProperty('submitURL');
  });
});

describe('registerProcessGoneHandlers', () => {
  it('registers render-process-gone and child-process-gone on the app', () => {
    registerProcessGoneHandlers();

    const events = (mockedApp.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(events).toContain('render-process-gone');
    expect(events).toContain('child-process-gone');
  });

  it('logs crashed renderers at error level and clean exits at info level', () => {
    registerProcessGoneHandlers();
    // App-level render-process-gone: (event, webContents, details).
    const renderHandler = (mockedApp.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'render-process-gone',
    )![1] as (
      event: unknown,
      webContents: unknown,
      details: { reason: string; exitCode: number },
    ) => void;

    renderHandler({}, {}, { reason: 'crashed', exitCode: -1073741819 });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.info).not.toHaveBeenCalled();

    renderHandler({}, {}, { reason: 'clean-exit', exitCode: 0 });
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1); // unchanged
  });

  it('logs crashed child processes with their process type', () => {
    registerProcessGoneHandlers();
    const childHandler = (mockedApp.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'child-process-gone',
    )![1] as (
      event: unknown,
      details: { reason: string; exitCode: number; type: string },
    ) => void;

    childHandler({}, { reason: 'killed', exitCode: 1, type: 'GPU Process' });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith('Child process gone:', {
      reason: 'killed',
      exitCode: 1,
      type: 'GPU Process',
    });
  });
});

describe('startCatchingProcessErrors', () => {
  it('catches uncaught errors without the OS crash dialog', () => {
    startCatchingProcessErrors();
    expect(log.errorHandler.startCatching).toHaveBeenCalledWith({ showDialog: false });
  });
});

describe('initDiagnostics', () => {
  it('wires logging, crash reporting, and error handlers; logs both paths', () => {
    const paths = initDiagnostics();

    expect(mockedApp.getPath).toHaveBeenCalledWith('userData');
    expect(mockedApp.setPath).toHaveBeenCalledWith('crashDumps', paths.crashDumpsDir);
    expect(mockedCrashReporter.start).toHaveBeenCalledWith({ uploadToServer: false });
    expect(log.errorHandler.startCatching).toHaveBeenCalledWith({ showDialog: false });

    const readyMessage = (log.info as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
    expect(readyMessage).toContain('main.log');
    expect(readyMessage).toContain(paths.crashDumpsDir);
  });

  it('degrades to console-only when the logs dir is unwritable (no throw)', () => {
    mkdirMock.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    let returned: ReturnType<typeof initDiagnostics> | undefined;
    expect(() => {
      returned = initDiagnostics();
    }).not.toThrow();

    expect(returned).toBeDefined();
    expect(log.transports.file.level).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('file logging disabled'),
      expect.any(Error),
    );

    // The boot line still lands (via console transport + scope logger).
    const readyMessage = (log.info as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
    expect(readyMessage).toContain('main.log');
  });

  it('continues boot when the crash reporter itself fails to start', () => {
    vi.mocked(mockedCrashReporter.start).mockImplementationOnce(() => {
      throw new Error('crashpad unavailable');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => initDiagnostics()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Crash reporter failed to start'),
      expect.any(Error),
    );
  });
});
