import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * queryCache is an exported singleton with no reset seam, so every test
 * loads a fresh module instance via resetModules + dynamic import. jsdom
 * provides localStorage for the persistable-key behavior. Fake timers drive
 * the TTL math (Date.now()-based).
 */
const loadCache = async () => {
  vi.resetModules();
  return import('../queryCache');
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('queryCache — memory + localStorage TTL', () => {
  it('returns cached data inside the TTL and null after expiry (memory)', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', { id: 's1' }, 60_000);

    expect(queryCache.get('subjects_all')).toEqual({ id: 's1' });

    vi.advanceTimersByTime(60_001);
    expect(queryCache.get('subjects_all')).toBeNull();
  });

  it('persists persistable keys and restores them from localStorage after a memory miss', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', ['math'], 60_000);
    expect(localStorage.getItem('cache_subjects_all')).not.toBeNull();

    // A fresh module = cold memory cache; localStorage still has the entry.
    const fresh = await loadCache();
    expect(fresh.queryCache.get('subjects_all')).toEqual(['math']);
  });

  it('removes expired localStorage entries on read', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', 'stale', 60_000);

    vi.advanceTimersByTime(60_001);
    // Memory expiry removed the localStorage copy on read.
    expect(queryCache.get('subjects_all')).toBeNull();
    expect(localStorage.getItem('cache_subjects_all')).toBeNull();
  });

  it('expired localStorage entries are dropped, not served (cold module)', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', 'stale', 60_000);
    vi.advanceTimersByTime(60_001);

    const fresh = await loadCache();
    expect(fresh.queryCache.get('subjects_all')).toBeNull();
    expect(localStorage.getItem('cache_subjects_all')).toBeNull();
  });

  it('restores to the memory cache ONLY for persistable keys (reference identity probe)', async () => {
    // Non-persistable keys never reach localStorage through set(), so seed
    // the storage directly the way a stale write would have.
    localStorage.setItem(
      'cache_profile_user-1',
      JSON.stringify({ data: { name: 'Ahmed' }, timestamp: Date.now(), ttl: 60_000 }),
    );
    localStorage.setItem(
      'cache_subjects_all',
      JSON.stringify({ data: ['math'], timestamp: Date.now(), ttl: 60_000 }),
    );
    const { queryCache } = await loadCache();

    // Persistable: first read promotes the entry to memory → same reference.
    const first = queryCache.get<{ data: string[] }>('subjects_all');
    const second = queryCache.get<{ data: string[] }>('subjects_all');
    expect(first).toBe(second);

    // Non-persistable (PII): served from storage, never promoted — each read
    // parses a fresh object.
    const profileA = queryCache.get<{ name: string }>('profile_user-1');
    const profileB = queryCache.get<{ name: string }>('profile_user-1');
    expect(profileA).toEqual({ name: 'Ahmed' });
    expect(profileA).not.toBe(profileB);
  });
});

describe('queryCache — PII allowlist (shouldPersist)', () => {
  it.each([
    ['subjects_all', true],
    ['platform_settings', true],
    ['academic_options_cache', true],
    ['levels_all', true],
    ['settings_ui', true],
    ['profile_user-1', false],
    ['notifications_u-9', false],
    ['summaries_all', false],
    ['news_all', false],
  ])('%s persists = %s', async (key, expected) => {
    const { queryCache } = await loadCache();
    queryCache.set(key, 'payload', 60_000);
    const stored = localStorage.getItem(`cache_${key}`);
    expect(Boolean(stored)).toBe(expected);
  });

  it('localStorage write failures never break set()', async () => {
    const { queryCache } = await loadCache();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => queryCache.set('subjects_all', 'x', 1000)).not.toThrow();
    expect(queryCache.get('subjects_all')).toBe('x'); // memory still works
    spy.mockRestore();
  });
});

describe('queryCache — invalidation', () => {
  it('invalidate/delete removes one key from memory and localStorage', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', 'a', 60_000);
    queryCache.invalidate('subjects_all');
    expect(queryCache.get('subjects_all')).toBeNull();
    expect(localStorage.getItem('cache_subjects_all')).toBeNull();

    queryCache.set('subjects_all', 'b', 60_000);
    queryCache.delete('subjects_all');
    expect(queryCache.get('subjects_all')).toBeNull();
  });

  it('invalidatePrefix clears matching memory entries and leaves the rest', async () => {
    const { queryCache } = await loadCache();
    queryCache.set('subjects_all', 'a', 60_000);
    queryCache.set('subjects_details_x', 'b', 60_000);
    queryCache.set('news_all', 'c', 60_000);

    queryCache.invalidatePrefix('subjects');
    expect(queryCache.get('subjects_all')).toBeNull();
    expect(queryCache.get('subjects_details_x')).toBeNull();
    expect(queryCache.get('news_all')).toBe('c');
  });

  it('invalidatePrefix removes ALL matching localStorage entries (index-shift bug guard)', async () => {
    const { queryCache } = await loadCache();
    // Seed several prefix-matching entries plus a non-matching one.
    localStorage.setItem('cache_subjects_a', '1');
    localStorage.setItem('cache_subjects_b', '2');
    localStorage.setItem('cache_subjects_c', '3');
    localStorage.setItem('cache_news_all', '4');

    queryCache.invalidatePrefix('subjects');

    expect(localStorage.getItem('cache_subjects_a')).toBeNull();
    expect(localStorage.getItem('cache_subjects_b')).toBeNull();
    expect(localStorage.getItem('cache_subjects_c')).toBeNull();
    expect(localStorage.getItem('cache_news_all')).toBe('4');
  });
});

describe('cacheKeys / cacheTTL contracts', () => {
  it('generates the documented key names', async () => {
    const { cacheKeys } = await loadCache();
    expect(cacheKeys.notifications('u1')).toBe('notifications_u1');
    expect(cacheKeys.summaries()).toBe('summaries_all');
    expect(cacheKeys.news()).toBe('news_all');
    expect(cacheKeys.appeals()).toBe('appeals_all');
    expect(cacheKeys.profile('u1')).toBe('profile_u1');
    expect(cacheKeys.subjects()).toBe('subjects_all');
    expect(cacheKeys.videos()).toBe('videos_all');
    expect(cacheKeys.files()).toBe('files_all');
    expect(cacheKeys.subjectLectures('math')).toBe('lectures_math');
    expect(cacheKeys.subjectDetails('math')).toBe('subject_details_math');
    expect(cacheKeys.settings()).toBe('platform_settings');
    expect(cacheKeys.enrollments()).toBe('enrollments_all');
    expect(cacheKeys.enrollments('inst-1')).toBe('enrollments_inst_inst-1');
  });

  it('keeps the documented TTLs (ms)', async () => {
    const { cacheTTL } = await loadCache();
    expect(cacheTTL.notifications).toBe(60_000); // 1 minute — real-time feel
    expect(cacheTTL.summaries).toBe(3_600_000); // 1 hour
    expect(cacheTTL.news).toBe(15 * 60_000); // 15 minutes
    expect(cacheTTL.appeals).toBe(30 * 60_000); // 30 minutes
    expect(cacheTTL.profile).toBe(30 * 60_000); // 30 minutes
    expect(cacheTTL.subjects).toBe(24 * 60 * 60_000); // 24 hours
    expect(cacheTTL.levels).toBe(48 * 60 * 60_000); // 48 hours
    expect(cacheTTL.settings).toBe(24 * 60 * 60_000); // 24 hours
    expect(cacheTTL.enrollments).toBe(10 * 60_000); // 10 minutes (gated)
  });

  it('every TTL is a positive integer', async () => {
    const { cacheTTL } = await loadCache();
    for (const [key, ttl] of Object.entries(cacheTTL)) {
      expect(Number.isInteger(ttl), key).toBe(true);
      expect(ttl, key).toBeGreaterThan(0);
    }
  });
});
