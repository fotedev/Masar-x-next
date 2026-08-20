import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';

// ============================================================================
// T022 — Contract test for LocalReadCache (read-cache.ts)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T022
// Data: specs/004-multi-platform-expansion/data-model.md §"LocalReadCache"
//
// This test defines the contract that `apps/desktop/src/main/read-cache.ts`
// must satisfy. It is written FIRST (TDD red phase). It MUST fail until T022
// implements the LocalReadCache class.
//
// The contract has seven assertions:
//   1. get(key) returns null for a missing key.
//   2. set(key, value) then get(key) round-trips the value.
//   3. get(key) returns { value, cached_at, expires_at, isStale: false }
//      for a fresh entry.
//   4. get(key) returns null when the entry is past its expires_at
//      (we test the boundary by setting a very short TTL).
//   5. delete(key) removes the entry; get(key) returns null afterwards.
//   6. prune() removes only entries past the grace period.
//   7. close() closes the DB handle; subsequent ops fail gracefully.
//
// We use an in-memory SQLite DB (`:memory:`) per test via the optional
// `db` constructor arg, so tests are fast and isolated. No temp file
// cleanup, no parallel-test interference.
// ============================================================================

// Import the type and the factory AFTER we have defined the constructor
// signature in our heads. The import will fail until the file is created.
import { LocalReadCache } from '../read-cache.js';

// --- in-memory per-test cache instance ---------------------------------------

let cache: LocalReadCache;
let tmpDir: string;

beforeEach(() => {
  // The cache writes WAL/SHM files even when the main DB is in-memory
  // if you specify a path; with `:memory:` it stays in-memory and the
  // tmp dir is just a parent for any future file-mode tests.
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'masarx-readcache-'));
  // We pass a dummy userDataPath; the test uses the in-memory DB
  // because the LocalReadCache constructor opens with `':memory:'`
  // when `db` is provided. See the implementation for the exact contract.
  cache = new LocalReadCache({ userDataPath: tmpDir, useInMemoryDb: true });
});

afterEach(() => {
  cache.close();
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- tests -------------------------------------------------------------------

describe('T022 — LocalReadCache contract', () => {
  it('returns null for a missing key', () => {
    expect(cache.get('does-not-exist')).toBeNull();
  });

  it('round-trips a value through set → get', () => {
    const value = { id: 'summary-1', title: 'Intro', body: '# Hi' };
    cache.set('study_summary:summary-1', value, { ttlMs: 60_000 });
    const entry = cache.get('study_summary:summary-1');
    expect(entry).not.toBeNull();
    expect(entry?.value).toEqual(value);
  });

  it('returns a fresh entry with cached_at, expires_at, isStale: false', () => {
    const before = Date.now();
    cache.set('key-1', { hello: 'world' }, { ttlMs: 60_000 });
    const after = Date.now();

    const entry = cache.get('key-1');
    expect(entry).not.toBeNull();
    expect(entry?.value).toEqual({ hello: 'world' });
    expect(entry?.isStale).toBe(false);
    // cached_at should be within [before, after]
    expect(entry!.cached_at).toBeGreaterThanOrEqual(before);
    expect(entry!.cached_at).toBeLessThanOrEqual(after);
    // expires_at = cached_at + ttlMs
    expect(entry!.expires_at).toBe(entry!.cached_at + 60_000);
  });

  it('returns null when the entry is past its expires_at (boundary)', async () => {
    // Use a 10ms TTL so we can wait for it to expire in real time.
    cache.set('short-ttl', { x: 1 }, { ttlMs: 10 });
    expect(cache.get('short-ttl')).not.toBeNull();

    // Wait past the expiry.
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(cache.get('short-ttl')).toBeNull();
  });

  it('delete removes the entry', () => {
    cache.set('k', { v: 1 }, { ttlMs: 60_000 });
    expect(cache.get('k')).not.toBeNull();

    cache.delete('k');
    expect(cache.get('k')).toBeNull();
  });

  it('prune removes only entries past the grace period', async () => {
    // Set an entry that "looks" old by writing then manually back-dating
    // its expires_at to be 10 days ago. prune() with the default 7-day
    // grace period should remove it.
    cache.set('old', { v: 1 }, { ttlMs: 60_000 });
    // We can't easily back-date without a direct DB handle, so we use
    // the public API: set with a tiny TTL, wait, then prune with a
    // 0-grace period. The tiny-TTL entry should be pruned; a fresh
    // entry should survive.
    cache.set('fresh', { v: 2 }, { ttlMs: 60_000 });
    cache.set('expiring', { v: 3 }, { ttlMs: 5 });

    await new Promise((resolve) => setTimeout(resolve, 15));
    // With a 0-grace prune, any entry past expires_at is removed.
    const removed = cache.prune(0);

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(cache.get('expiring')).toBeNull();
    expect(cache.get('fresh')).not.toBeNull();
    expect(cache.get('old')).not.toBeNull();
  });

  it('close() releases the DB handle', () => {
    cache.set('k', { v: 1 }, { ttlMs: 60_000 });
    cache.close();
    // Subsequent set/get must throw or return null — the exact
    // behavior is up to the implementation, but it must not silently
    // succeed (which would mask a bug). We assert that the cache is
    // not usable.
    expect(() => cache.set('k2', { v: 2 })).toThrow();
  });
});
