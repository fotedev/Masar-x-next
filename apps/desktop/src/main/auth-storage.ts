import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';

// ============================================================================
// auth-storage.ts — LocalAuthSession (T021)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T021
// Data: specs/004-multi-platform-expansion/data-model.md §"LocalAuthSession"
//
// Persists the Supabase auth session in an encrypted file under
// `<userData>/auth/session.bin`. Encryption is delegated to Electron's
// `safeStorage` API (DPAPI on Windows, Keychain on macOS, libsecret/kwallet
// on Linux). We do NOT roll our own crypto — `safeStorage` is the OS-native
// path and the only correct way to do this on Electron.
//
// File layout:
//   <userData>/auth/session.bin     — current session
//   <userData>/auth/session.bin.bak — last-known-good backup
//
// Atomic write: encrypt → write to `.tmp` → fs.rename to `session.bin` →
// copy to `.bak`. The backup guards against partial-write corruption
// (e.g. power loss between encrypt and rename).
// ============================================================================

export interface LocalAuthSessionOptions {
  /** Absolute path to the Electron `app.getPath('userData')` directory. */
  userDataPath: string;
}

export type Unsubscribe = () => void;

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: { id: string; email?: string; [k: string]: unknown };
  [k: string]: unknown;
}

/**
 * Persistent encrypted Supabase auth session.
 *
 * Lifecycle (per data-model.md):
 *   - read()    — return the current session, or null if none
 *   - write(s)  — persist a new session (replaces any existing one)
 *   - clear()   — delete the session file (called on sign-out)
 *   - onChange  — subscribe to write/clear events for multi-window sync
 */
export class LocalAuthSession {
  private readonly sessionFile: string;
  private readonly backupFile: string;
  private readonly subscribers = new Set<(s: StoredSession | null) => void>();
  private warnedAboutLinuxFallback = false;

  constructor(opts: LocalAuthSessionOptions) {
    if (!opts.userDataPath) {
      throw new Error('LocalAuthSession: `userDataPath` is required');
    }
    const authDir = path.join(opts.userDataPath, 'auth');
    this.sessionFile = path.join(authDir, 'session.bin');
    this.backupFile = path.join(authDir, 'session.bin.bak');

    // Ensure the auth dir exists. mkdirSync is safe to call repeatedly;
    // we do it eagerly so the first write doesn't race the read.
    if (!existsSync(authDir)) {
      mkdirSync(authDir, { recursive: true });
    }

    this.checkEncryptionBackend();
  }

  /**
   * Verify the OS keystore is available. On Linux with `basic_text`
   * (no DE keyring), the file is still encrypted but with an
   * in-memory password — significantly weaker. We log a one-time
   * warning so the operator/user can install a real keyring.
   */
  private checkEncryptionBackend(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'LocalAuthSession: `safeStorage` reports encryption is NOT available. ' +
          'On Windows, wait for `app.whenReady()` before constructing LocalAuthSession. ' +
          'On Linux, install gnome-keyring or kwallet.',
      );
    }
    if (process.platform === 'linux') {
      const backend = safeStorage.getSelectedStorageBackend();
      if (backend === 'basic_text' && !this.warnedAboutLinuxFallback) {
        this.warnedAboutLinuxFallback = true;
        // eslint-disable-next-line no-console
        console.warn(
          '[masarx-desktop] safeStorage is using `basic_text` on Linux. ' +
            'The session file is encrypted with an in-memory password and ' +
            'is NOT protected by the OS keystore. ' +
            'Install gnome-keyring or kwallet for proper protection.',
        );
      }
    }
  }

  /**
   * Read the persisted session, or `null` if no session has been written
   * (or the file is corrupt / decryption fails).
   */
  async read(): Promise<StoredSession | null> {
    let raw: Buffer;
    try {
      raw = await fs.readFile(this.sessionFile);
    } catch (err) {
      // ENOENT = no session yet. Anything else: try the backup.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }
      // Try the backup file before giving up.
      try {
        raw = await fs.readFile(this.backupFile);
      } catch {
        return null;
      }
    }

    try {
      // Electron 32.3.3 type definitions only expose the sync API;
      // the async variants (`encryptStringAsync` / `decryptStringAsync`)
      // are runtime-available but not yet typed. Sync is fine here:
      // the first call may briefly block on macOS (Keychain prompt),
      // but the renderer is loading the local server at the same time.
      const result = safeStorage.decryptString(raw);
      const session = JSON.parse(result) as StoredSession;
      return session;
    } catch {
      // Corrupt or undecryptable file. Treat as no session so the user
      // is prompted to sign in again rather than crashing the app.
      return null;
    }
  }

  /**
   * Persist `session` to disk. Atomic via temp + rename, plus a
   * last-known-good backup. Emits an `onChange` event on success.
   */
  async write(session: StoredSession): Promise<void> {
    const plaintext = JSON.stringify(session);
    const encrypted = safeStorage.encryptString(plaintext);

    const tmpFile = this.sessionFile + '.tmp';
    await fs.writeFile(tmpFile, encrypted, { mode: 0o600 });
    await fs.rename(tmpFile, this.sessionFile);

    // Best-effort backup. Failure is non-fatal (the rename already
    // committed the new state); we just won't have a fallback.
    try {
      await fs.copyFile(this.sessionFile, this.backupFile);
    } catch {
      /* ignore */
    }

    this.emit(session);
  }

  /**
   * Delete the session file (and the backup). Emits an `onChange`
   * event with `null`.
   */
  async clear(): Promise<void> {
    await Promise.all([
      fs.unlink(this.sessionFile).catch((err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') throw err;
      }),
      fs.unlink(this.backupFile).catch((err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') throw err;
      }),
    ]);
    this.emit(null);
  }

  /**
   * Subscribe to write/clear events. Returns an unsubscribe function.
   * Used by the main process to push `auth:changed` to all renderers
   * (for v1 we have a single renderer; the wiring is in place for v2).
   */
  onChange(cb: (session: StoredSession | null) => void): Unsubscribe {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private emit(session: StoredSession | null): void {
    for (const cb of this.subscribers) {
      try {
        cb(session);
      } catch {
        // Subscriber errors must not break the write/clear path.
      }
    }
  }
}
