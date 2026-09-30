import { app, crashReporter } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import log from 'electron-log/main';

// ============================================================================
// logging.ts — Diagnostics boot: Crashpad dumps + file logging (spec 028)
//
// Spec: specs/028-desktop-crashpad-logs/spec.md
// Audit: docs/audits/desktop-app-report-2026-09-08 R7 ("field failures
// invisible") — console-only logs are lost in packaged builds and crashes
// were never captured.
//
// Responsibilities:
//   1. Resolve the diagnostics directories under userData (logs/, crashDumps/).
//   2. Configure electron-log's file transport (userData/logs/main.log,
//      5 MB rotation) + keep the console transport for dev terminals.
//   3. Start Chromium's Crashpad via crashReporter.start({ uploadToServer:
//      false }) — minidumps stay LOCAL (userData/crashDumps). Remote
//      submission is an explicitly deferred owner decision; no submitURL,
//      no DSN, no network calls.
//   4. Catch uncaughtException/unhandledRejection (electron-log errorHandler,
//      no crash dialog) and app-level render-process-gone /
//      child-process-gone so field failures land in the log file.
//
// Boot-order contract (must hold): app.setName('masarx') [updater.ts module
// scope] → initDiagnostics() [index.ts module scope, under Electron only] →
// everything else (single-instance lock, server spawn, windows). All steps
// degrade instead of throwing: a broken diagnostics setup must never take
// down boot.
// ============================================================================

export interface DiagnosticsPaths {
  /** Directory holding main.log (userData/logs). */
  logsDir: string;
  /** Directory holding Crashpad minidumps (userData/crashDumps). */
  crashDumpsDir: string;
}

const LOG_FILE_NAME = 'main.log';
// Default is 1 MB; a single chat-heavy session can churn more than that.
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024;

/** Pure path derivation — kept separate so tests need no electron mocks. */
export function resolveDiagnosticsPaths(userDataPath: string): DiagnosticsPaths {
  return {
    logsDir: path.join(userDataPath, 'logs'),
    crashDumpsDir: path.join(userDataPath, 'crashDumps'),
  };
}

export function logFilePath(paths: DiagnosticsPaths): string {
  return path.join(paths.logsDir, LOG_FILE_NAME);
}

// Scoped loggers — messages keep the historical `[masarx-desktop]` tag shape.
// `next-server` covers the piped stdout/stderr of the packaged Next.js child
// (server.ts); electron-updater auto-forwards its own messages to electron-log.
export const desktopLog = log.scope('masarx-desktop');
export const nextServerLog = log.scope('next-server');

export function initLogging(paths: DiagnosticsPaths): void {
  log.transports.file.resolvePathFn = () => logFilePath(paths);
  log.transports.file.maxSize = MAX_LOG_SIZE_BYTES;
  log.transports.file.level = 'info';
  // Console transport mirrors the file so `pnpm dev` terminal output keeps
  // working; in packaged builds there is no terminal and the file is the record.
  log.transports.console.level = 'info';
}

/**
 * Point Chromium's Crashpad at our crashDumps dir and start local capture.
 * `setPath` must precede `crashReporter.start`; both must run before app
 * ready (initDiagnostics is called from index.ts module scope).
 */
export function initCrashReporting(crashDumpsDir: string): void {
  app.setPath('crashDumps', crashDumpsDir);
  crashReporter.start({ uploadToServer: false });
}

/** uncaughtException + unhandledRejection → all transports, no OS dialog. */
export function startCatchingProcessErrors(): void {
  log.errorHandler.startCatching({ showDialog: false });
}

/**
 * Renderer/child-process crashes are not JS exceptions — Crashpad records
 * the minidump, this records the metadata (reason, exitCode, process type)
 * next to it in the log file.
 */
export function registerProcessGoneHandlers(): void {
  // App-level render-process-gone carries the webContents as its second arg;
  // details (reason/exitCode) come third.
  app.on('render-process-gone', (_event, _webContents, details) => {
    if (details.reason === 'clean-exit') {
      desktopLog.info('Renderer process exited cleanly.');
    } else {
      desktopLog.error('Renderer process gone:', details);
    }
  });
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') {
      desktopLog.info(`Child process (${details.type}) exited cleanly.`);
    } else {
      desktopLog.error('Child process gone:', details);
    }
  });
}

/**
 * One-stop diagnostics boot. Runs at index.ts module scope under real
 * Electron only (guarded by process.versions.electron — same pattern as the
 * auto-start block), which keeps Vitest/plain-node imports inert.
 */
export function initDiagnostics(): DiagnosticsPaths {
  const paths = resolveDiagnosticsPaths(app.getPath('userData'));

  // Probe writability up front: if the dir can't be created/used, disable
  // the file transport entirely instead of risking a throwing write on
  // every subsequent log call ("unconfigured ≠ crash", mirrors spec 023).
  try {
    mkdirSync(paths.logsDir, { recursive: true });
    initLogging(paths);
  } catch (err) {
    log.transports.file.level = false;
    console.error('[masarx-desktop] Log directory unavailable; file logging disabled:', err);
  }

  try {
    initCrashReporting(paths.crashDumpsDir);
  } catch (err) {
    console.error('[masarx-desktop] Crash reporter failed to start (continuing without):', err);
  }

  startCatchingProcessErrors();
  registerProcessGoneHandlers();

  desktopLog.info(
    `Diagnostics ready. Log file: ${logFilePath(paths)}. Crash dumps: ${paths.crashDumpsDir}`,
  );
  return paths;
}
