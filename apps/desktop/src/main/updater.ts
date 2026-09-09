import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
// electron-updater is a CommonJS module whose `autoUpdater` is a lazy
// getter on `module.exports`. The named-import form
// `import { autoUpdater } from 'electron-updater'` is recognized by the
// .d.ts but Node's ESM loader rejects it at runtime
// (`SyntaxError: Named export 'autoUpdater' not found`). And
// `import * as ns from 'electron-updater'` returns a namespace where
// `ns.autoUpdater` is undefined (the getter only fires on the
// module.exports default). So we use the synthetic default import
// (esModuleInterop: true) and destructure from there. Type-only imports
// still work as before.
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import type { UpdateInfo } from 'electron-updater';

// ============================================================================
// updater.ts — Auto-update with rollback (T023)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T023
// Research: specs/004-multi-platform-expansion/research.md §6
//
// Wraps electron-updater's `autoUpdater` in a testable class. Responsibilities:
//   - Check for updates on app startup (and on demand).
//   - Stream update events to subscribers (renderer bridge).
//   - Write a first-launch trial flag when an update is applied; clear it
//     after 30s of healthy runtime; if it persists across app restarts,
//     roll back to the previous version (electron-updater's N-1 asar).
//   - Rate-limit manual `checkFor` calls to avoid hitting GitHub's
//     unauthenticated 60 req/h limit.
//
// The class accepts a constructor arg so tests can inject a mock
// `autoUpdater` shape (the production wiring uses the real one from
// `electron-updater`).
// ============================================================================

export interface UpdaterOptions {
  /** Absolute path to the Electron `app.getPath('userData')` directory. */
  userDataPath: string;
  /** Override the autoUpdater instance (tests inject a mock). */
  autoUpdaterOverride?: typeof autoUpdater;
  /** Trial period (ms) before the pending-update flag is cleared. Default 30s. */
  trialMs?: number;
  /** Rate-limit window for manual `checkFor` calls (ms). Default 1h. */
  checkForRateLimitMs?: number;
}

export interface UpdateAvailableInfo {
  version: string;
  releaseDate?: string;
}

export type Unsubscribe = () => void;


const DEFAULT_TRIAL_MS = 30_000;
const DEFAULT_RATE_LIMIT_MS = 60 * 60 * 1000;
const FLAG_FILE = 'pending-update.json';
// Records the version of the last boot. A mismatch between this and the
// running version is the reliable "an update was just applied" signal
// (audit 2026-09-08 R9) — see checkOnStartup().
const VERSION_MARKER_FILE = 'last-version.json';

// `electron-updater` derives the download/cache folder from `app.name`
// as `<name>-updater`. The packaged app's `package.json` keeps
// `"name": "desktop"` for pnpm workspace compatibility (renaming it
// would break `apps/desktop` resolution in the monorepo), so we
// override `app.name` once at module load. The override must happen
// BEFORE `autoUpdater` makes its first check; both `isAutoUpdateEnabled`
// and the boot path below run after this line, so we're safe.
app.setName('masarx');

export function isPortable(): boolean {
  return Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE ||
    process.env.PORTABLE_EXECUTABLE_APP_FILENAME,
  );
}

/**
 * Returns true when the running app should actually consult the
 * `autoUpdater` feed. Two disqualifying cases:
 *
 *   1. Portable build — electron-builder's portable target is a single
 *      self-extracting .exe; `electron-updater`'s Squirrel.Windows
 *      update flow doesn't apply to it.
 *   2. Dev mode — `app.isPackaged` is false when running via
 *      `electron .` (unpackaged). There's no GitHub release feed to
 *      check against, and the call would just emit a noisy warning.
 *
 * Read at call time (not module load) so the test can flip
 * `app.isPackaged` per test.
 */
export function isAutoUpdateEnabled(): boolean {
  return !isPortable() && app.isPackaged;
}

export class Updater {
  private readonly userDataPath: string;
  private readonly au: typeof autoUpdater;
  private readonly trialMs: number;
  private readonly rateLimitMs: number;
  private readonly flagPath: string;
  private readonly versionMarkerPath: string;
  private lastCheckAt = 0;
  private trialTimer: NodeJS.Timeout | null = null;

  private readonly availableSubs = new Set<(info: UpdateAvailableInfo) => void>();
  private readonly progressSubs = new Set<(p: { percent: number }) => void>();
  private readonly errorSubs = new Set<(err: Error) => void>();

  constructor(opts: UpdaterOptions) {
    if (!opts.userDataPath) {
      throw new Error('Updater: `userDataPath` is required');
    }
    this.userDataPath = opts.userDataPath;
    this.au = opts.autoUpdaterOverride ?? autoUpdater;
    this.trialMs = opts.trialMs ?? DEFAULT_TRIAL_MS;
    this.rateLimitMs = opts.checkForRateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
    this.flagPath = path.join(this.userDataPath, FLAG_FILE);
    this.versionMarkerPath = path.join(this.userDataPath, VERSION_MARKER_FILE);

    if (!existsSync(this.userDataPath)) {
      mkdirSync(this.userDataPath, { recursive: true });
    }

    this.wireAutoUpdaterEvents();
  }

  // --- public API ---------------------------------------------------------

  /**
   * Check for updates on app startup. Idempotent within the rate-limit
   * window. Triggers the auto-download flow if an update is found.
   */
  async checkOnStartup(): Promise<UpdateAvailableInfo | null> {
    if (!isAutoUpdateEnabled()) {
      // eslint-disable-next-line no-console
      console.log('[masarx-desktop] Auto-updater disabled (dev or portable); skipping startup check.');
      return null;
    }

    // Enable auto-download + install-on-quit before checking. These are
    // the defaults per electron-updater docs; we set them explicitly so
    // the behavior is in one place.
    this.au.autoDownload = true;
    this.au.autoInstallOnAppQuit = true;

    // Record which binary is running now BEFORE anything else so rollback
    // and restart loops always converge (the marker must describe the
    // current boot, not a previous one).
    const previousVersion = await this.readVersionMarker();
    await this.writeVersionMarker(app.getVersion());

    // First-launch rollback: if a stale flag from a previous attempt
    // exists, roll back BEFORE doing a new check. The flag means the
    // previous version didn't run the trial successfully. This check MUST
    // precede the trial write below — otherwise the flag we just wrote
    // would trigger an immediate rollback on the same call.
    if (existsSync(this.flagPath)) {
      await this.rollback();
      return null;
    }

    // First boot of a different version ⇒ an update (or rollback) was just
    // applied. electron-updater applies install-on-quit updates while the
    // OLD process is exiting, so 'update-downloaded' fires too early to
    // carry the trial (audit 2026-09-08 R9): a 30s timer started there is
    // virtually always cleared before the new version boots, leaving the
    // rollback path unreachable. The trial therefore starts HERE, in the
    // version that was just applied. If it crashes before the timer fires,
    // the flag survives to the next boot and the rollback check above runs.
    if (previousVersion && previousVersion !== app.getVersion()) {
      await this.writeFlag({ version: app.getVersion(), appliedAt: Date.now() });
      this.startTrialTimer();
    }

    try {
      this.lastCheckAt = Date.now();
      await this.au.checkForUpdates();
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.warn('[masarx-desktop] Startup update check failed or skipped:', err);
    }
    return null; // The update-available event is what tells the caller.
  }

  /**
   * Manual check (e.g. from a menu item "Check for updates"). Rate-limited
   * to one call per `rateLimitMs` window.
   */
  async checkFor(): Promise<UpdateAvailableInfo | null> {
    if (!isAutoUpdateEnabled()) {
      return null;
    }

    const now = Date.now();
    if (now - this.lastCheckAt < this.rateLimitMs) {
      return null;
    }
    try {
      this.lastCheckAt = now;
      await this.au.checkForUpdates();
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.warn('[masarx-desktop] Manual update check failed:', err);
    }
    return null;
  }

  /**
   * Download the available update (if any). Called explicitly when the
   * user opts in (most apps let `autoDownload: true` handle this).
   */
  async download(): Promise<void> {
    await this.au.downloadUpdate();
  }

  /**
   * Install the downloaded update and restart the app. We do NOT call
   * `app.quit()` ourselves — `quitAndInstall()` handles the quit
   * internally per electron-updater's documented behavior.
   */
  installAndRestart(): void {
    this.au.quitAndInstall();
  }

  /**
   * Skip the given version (the user said "remind me later"). The next
   * check will still see this version as the latest; the user can
   * upgrade via "Check for updates" menu later.
   *
   * `skipUpdateCallback` is a runtime field on autoUpdater that the
   * AppUpdater type doesn't expose. Cast through `unknown` so the
   * test's vi.fn() mock is also satisfied.
   */
  skipThisVersion(version: string): void {
    const auAny = this.au as unknown as {
      skipUpdateCallback?: (info: { releaseName: string }) => void;
    };
    auAny.skipUpdateCallback?.({ releaseName: version });
  }

  /**
   * Subscribe to "update available" events. The callback is invoked when
   * `autoUpdater` fires `update-available`. Multiple subscribers are
   * supported (e.g. the main process fan-outs to all renderers).
   */
  onAvailable(cb: (info: UpdateAvailableInfo) => void): Unsubscribe {
    this.availableSubs.add(cb);
    return () => this.availableSubs.delete(cb);
  }

  onProgress(cb: (p: { percent: number }) => void): Unsubscribe {
    this.progressSubs.add(cb);
    return () => this.progressSubs.delete(cb);
  }

  onError(cb: (err: Error) => void): Unsubscribe {
    this.errorSubs.add(cb);
    return () => this.errorSubs.delete(cb);
  }

  // --- internal -----------------------------------------------------------

  private wireAutoUpdaterEvents(): void {
    this.au.on('update-available', (info: UpdateInfo) => {
      const payload: UpdateAvailableInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
      };
      for (const cb of this.availableSubs) {
        try {
          cb(payload);
        } catch {
          /* subscriber errors must not break the flow */
        }
      }
    });

    this.au.on('update-downloaded', (info: UpdateInfo) => {
      // NOTE (audit 2026-09-08 R9): the trial flag is intentionally NOT
      // written here. 'update-downloaded' fires in the old, still-running
      // process — a 30s timer started here would clear the flag before the
      // new version ever boots, making rollback unreachable. The trial
      // starts in checkOnStartup() when the recorded version differs from
      // the running one.
      // eslint-disable-next-line no-console
      console.log(`[masarx-desktop] Update downloaded: ${info.version}`);
    });

    this.au.on('download-progress', (p: { percent: number }) => {
      for (const cb of this.progressSubs) {
        try {
          cb({ percent: p.percent });
        } catch {
          /* ignore */
        }
      }
    });

    this.au.on('error', (err: Error) => {
      for (const cb of this.errorSubs) {
        try {
          cb(err);
        } catch {
          /* ignore */
        }
      }
    });
  }

  private async writeFlag(payload: { version: string; appliedAt: number }): Promise<void> {
    await fs.writeFile(this.flagPath, JSON.stringify(payload), 'utf8');
  }

  private async clearFlag(): Promise<void> {
    try {
      await fs.unlink(this.flagPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
  }

  private async readVersionMarker(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.versionMarkerPath, 'utf8');
      const parsed = JSON.parse(raw) as { version?: unknown };
      return typeof parsed.version === 'string' ? parsed.version : null;
    } catch {
      // Missing or corrupt marker: treat as "no previous version recorded"
      // so the first-ever boot does not start a trial.
      return null;
    }
  }

  private async writeVersionMarker(version: string): Promise<void> {
    try {
      await fs.writeFile(this.versionMarkerPath, JSON.stringify({ version }), 'utf8');
    } catch {
      // Marker write failure must never break the update flow.
    }
  }

  private startTrialTimer(): void {
    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
    }
    this.trialTimer = setTimeout(() => {
      // Trial passed: the app is still alive 30s after the update was
      // applied. Clear the flag so we don't roll back next launch.
      void this.clearFlag();
      this.trialTimer = null;
    }, this.trialMs);
    // Don't keep the event loop alive for this timer.
    this.trialTimer.unref?.();
  }

  /**
   * Roll back to the previous version. electron-updater's
   * `autoUpdater.install(force, silent)` re-runs the N-1 installer,
   * which is the previous version (Squirrel.Mac / Squirrel.Windows
   * keep N-1 on disk for exactly this case).
   */
  private async rollback(): Promise<void> {
    // eslint-disable-next-line no-console
    console.warn(
      '[masarx-desktop] Detected failed previous update; rolling back to N-1.',
    );
    // install(forceRunAfter = true, isSilent = true) per electron-updater docs.
    // `install` lives on BaseUpdater but isn't exposed in AppUpdater's type.
    const auAny = this.au as unknown as {
      install: (isForceRunAfter: boolean, isSilent: boolean) => boolean;
    };
    auAny.install(true, true);
    await this.clearFlag();
  }
}

/**
 * Boot-time helper: wires the main process to start the updater when
 * the app is ready, and broadcasts events to all renderers.
 *
 * Called from `index.ts`. Exported separately so the contract test can
 * verify the IPC wiring without spinning up the full app.
 */
export interface UpdaterBootOptions {
  updater: Updater;
  broadcast: (channel: string, payload: unknown) => void;
}

export function bootUpdater(opts: UpdaterBootOptions): void {
  if (!isAutoUpdateEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[masarx-desktop] Auto-updater disabled (dev or portable); skipping boot.');
    return;
  }

  opts.updater.onAvailable((info) => {
    opts.broadcast('updates:available', info);
  });
  opts.updater.onProgress((p) => {
    opts.broadcast('updates:progress', p);
  });
  opts.updater.onError((err) => {
    opts.broadcast('updates:error', { message: err.message });
  });

  // Defer the first check until after `app.whenReady()` — electron-updater
  // is fine being constructed early, but the first check is best done
  // when the main window is up so the renderer is ready to receive the
  // broadcast.
  if (app.isReady()) {
    void opts.updater.checkOnStartup();
  } else {
    app.on('ready', () => {
      void opts.updater.checkOnStartup();
    });
  }
}
