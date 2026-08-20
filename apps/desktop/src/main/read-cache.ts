import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';

// ============================================================================
// read-cache.ts — LocalReadCache (T022)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T022
// Data: specs/004-multi-platform-expansion/data-model.md §"LocalReadCache"
//
// Generic key-value cache for read-through Supabase queries. SQLite via
// `better-sqlite3` (synchronous, fast) with WAL mode and per-entry TTL.
//
// The renderer's data-fetching code does the read-through policy:
//   1. cache.get(key) → if hit (not expired), use it
//   2. else fetch from Supabase
//   3. cache.set(key, value) → write-back for next time
//
// The main process is just storage; the renderer owns the policy.
// ============================================================================

export interface LocalReadCacheOptions {
  /** Absolute path to the Electron `app.getPath('userData')` directory. */
  userDataPath: string;
  /**
   * Internal: pass `true` to use an in-memory SQLite DB instead of a file.
   * Used by the contract tests so they're fast and isolated. Production
   * code does NOT pass this; the file at `<userDataPath>/cache/cache.db`
   * is the production target.
   */
  useInMemoryDb?: boolean;
}

export interface CacheSetOptions {
  /** Time-to-live in milliseconds. Default 5 minutes. */
  ttlMs?: number;
  /**
   * Logical entity name for analytics / future invalidation
   * (e.g. 'study_summary', 'video', 'quiz'). Empty string if unspecified.
   */
  entity?: string;
}

export interface CacheEntry {
  value: unknown;
  cached_at: number;
  expires_at: number;
  /** Always `false` in v1; the entry has not yet expired. */
  isStale: false;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PRUNE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const SCHEMA_VERSION = 1;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS cache (
    key         TEXT PRIMARY KEY,
    value       BLOB NOT NULL,
    cached_at   INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    entity      TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
  CREATE INDEX IF NOT EXISTS idx_cache_entity  ON cache(entity);
`;

/**
 * Persistent key-value cache backed by SQLite.
 *
 * Per data-model.md:
 *   - read-through from Supabase
 *   - per-entry TTL
 *   - "offline, showing cached version" UI with timestamp
 */
export class LocalReadCache {
  private readonly db: DatabaseType;
  private readonly subscribers = new Set<(key: string) => void>();
  private closed = false;

  // Prepared statements (cached for performance — preparing on every
  // call is the difference between ~50k and ~500k ops/sec in better-sqlite3).
  // Initialized in the constructor via `prepareStatements()`; the `!`
  // tells TypeScript the assignment is definite. Declared without
  // `readonly` so the constructor's helper method can write to it.
  private stmts!: {
    get: Statement<[string]>;
    set: Statement<[string, Buffer, number, number, string]>;
    delete: Statement<[string]>;
    prune: Statement<[number]>;
  };

  constructor(opts: LocalReadCacheOptions) {
    if (!opts.userDataPath) {
      throw new Error('LocalReadCache: `userDataPath` is required');
    }

    if (opts.useInMemoryDb) {
      this.db = new Database(':memory:');
    } else {
      const cacheDir = path.join(opts.userDataPath, 'cache');
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      const dbPath = path.join(cacheDir, 'cache.db');
      this.db = new Database(dbPath);
    }

    // Performance pragmas (per data-model.md / plan):
    //   - WAL: concurrent readers + one writer
    //   - synchronous=NORMAL: safe with WAL, much faster than FULL
    //   - temp_store=MEMORY: don't spill temp tables to disk
    //   - mmap_size=64MB: memory-mapped I/O for the read path
    //   - foreign_keys=ON: good hygiene
    //   - busy_timeout=5s: wait for the writer lock instead of failing
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 67108864');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.runMigrations();
    this.prepareStatements();
  }

  // --- public API ---------------------------------------------------------

  /**
   * Read a cache entry. Returns `null` if the key is missing OR if the
   * entry has passed its `expires_at`. The renderer treats both cases
   * the same (fall back to Supabase + write-back).
   */
  get(key: string): CacheEntry | null {
    this.assertOpen();
    const row = this.stmts.get.get(key) as
      | { value: Buffer; cached_at: number; expires_at: number }
      | undefined;
    if (!row) {
      return null;
    }
    const now = Date.now();
    if (now > row.expires_at) {
      return null;
    }
    let value: unknown;
    try {
      value = JSON.parse(row.value.toString('utf8'));
    } catch {
      // Corrupt JSON — treat as miss so the caller re-fetches.
      return null;
    }
    return {
      value,
      cached_at: row.cached_at,
      expires_at: row.expires_at,
      isStale: false,
    };
  }

  /**
   * Write (or overwrite) a cache entry. Default TTL is 5 minutes; pass
   * `opts.ttlMs` to override.
   */
  set(key: string, value: unknown, opts: CacheSetOptions = {}): void {
    this.assertOpen();
    const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    if (ttlMs <= 0) {
      throw new Error('LocalReadCache.set: `ttlMs` must be > 0');
    }
    const now = Date.now();
    const encoded = Buffer.from(JSON.stringify(value), 'utf8');
    const entity = opts.entity ?? '';
    this.stmts.set.run(key, encoded, now, now + ttlMs, entity);
    this.emit(key);
  }

  /**
   * Remove a single entry. Used by the renderer after a write to Supabase
   * that should invalidate the local copy.
   */
  delete(key: string): void {
    this.assertOpen();
    this.stmts.delete.run(key);
    this.emit(key);
  }

  /**
   * Delete all entries whose `expires_at` is older than `now - gracePeriodMs`.
   * Returns the number of rows removed. Called by the main-process timer
   * (every 1h, `unref()`'d).
   */
  prune(gracePeriodMs: number = DEFAULT_PRUNE_GRACE_MS): number {
    this.assertOpen();
    const cutoff = Date.now() - gracePeriodMs;
    const result = this.stmts.prune.run(cutoff);
    return Number(result.changes);
  }

  /**
   * Subscribe to write/delete events. Used by future multi-window sync
   * (v1 has a single window; the wire is in place).
   */
  onChange(cb: (key: string) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /**
   * Release the DB handle. After close(), all subsequent ops throw.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }

  // --- internal -----------------------------------------------------------

  private runMigrations(): void {
    const current = this.db.pragma('user_version', { simple: true }) as number;
    if (current < SCHEMA_VERSION) {
      this.db.exec(CREATE_TABLE_SQL);
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  }

  private prepareStatements(): void {
    this.stmts = {
      get: this.db.prepare<[string]>(
        'SELECT value, cached_at, expires_at FROM cache WHERE key = ?',
      ),
      set: this.db.prepare<[string, Buffer, number, number, string]>(
        `INSERT OR REPLACE INTO cache (key, value, cached_at, expires_at, entity)
         VALUES (?, ?, ?, ?, ?)`,
      ),
      delete: this.db.prepare<[string]>('DELETE FROM cache WHERE key = ?'),
      prune: this.db.prepare<[number]>(
        'DELETE FROM cache WHERE expires_at < ?',
      ),
    };
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('LocalReadCache: DB handle is closed');
    }
  }

  private emit(key: string): void {
    for (const cb of this.subscribers) {
      try {
        cb(key);
      } catch {
        // Subscriber errors must not break the write/delete path.
      }
    }
  }
}
