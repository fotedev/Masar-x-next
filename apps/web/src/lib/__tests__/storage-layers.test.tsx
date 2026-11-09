import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers three small storage modules in one file:
 *  - lib/academic-utils.ts   (sessionStorage PII cache + localStorage options cache)
 *  - lib/storage-cleanup.ts  (legacy localStorage cleanup)
 *  - lib/admin-shell/storage.ts (crash-proof readJSON/writeJSON)
 */

const load = async <T extends object>(module: string): Promise<T> => {
  vi.resetModules();
  return import(module) as Promise<T>;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('academic-utils — academicCache (sessionStorage, T030 PII rules)', () => {
  it('round-trips the user academic payload without storing the userId', async () => {
    const { academicCache, USER_ACADEMIC_CACHE_KEY } = await load<typeof import('../academic-utils')>(
      '../academic-utils',
    );

    academicCache.setUserAcademic('user-42', { level: 2, semester: 1, department_id: 'd1' });

    // Entries are keyed per user (review D4, spec 040 PR-2) — the PAYLOAD
    // still never contains the userId (PII rule unchanged).
    const raw = sessionStorage.getItem(`${USER_ACADEMIC_CACHE_KEY}:user-42`);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('user-42'); // PII: userId never persisted in the payload
    expect(academicCache.getUserAcademic('user-42')).toEqual({
      level: 2,
      semester: 1,
      department_id: 'd1',
    });
  });

  it('expires after the 7-day TTL', async () => {
    vi.useFakeTimers();
    const { academicCache, USER_ACADEMIC_CACHE_KEY } = await load<typeof import('../academic-utils')>(
      '../academic-utils',
    );

    academicCache.setUserAcademic('u', { level: 3, semester: 2 });
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    expect(academicCache.getUserAcademic('u')).toBeNull();
    // The stale entry stays in storage; only the read treats it as missing.
    expect(sessionStorage.getItem(`${USER_ACADEMIC_CACHE_KEY}:u`)).not.toBeNull();
  });

  it('returns null for missing and corrupted cache entries', async () => {
    const { academicCache, USER_ACADEMIC_CACHE_KEY } = await load<typeof import('../academic-utils')>(
      '../academic-utils',
    );
    expect(academicCache.getUserAcademic('u')).toBeNull();

    sessionStorage.setItem(`${USER_ACADEMIC_CACHE_KEY}:u`, '{not json');
    expect(academicCache.getUserAcademic('u')).toBeNull();
  });

  it('dispatches masarx_user_academic_updated on write', async () => {
    const { academicCache } = await load<typeof import('../academic-utils')>('../academic-utils');
    const listener = vi.fn();
    window.addEventListener('masarx_user_academic_updated', listener);
    try {
      academicCache.setUserAcademic('u', { level: 1, semester: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('masarx_user_academic_updated', listener);
    }
  });

  it('caches levels/departments in localStorage with the same 7-day TTL', async () => {
    vi.useFakeTimers();
    const { academicCache } = await load<typeof import('../academic-utils')>('../academic-utils');

    const levels = [{ id: 'l1', name: 'المستوى الأول', level_number: 1 }];
    const departments = [{ id: 'd1', name: 'هندسة برمجيات', academic_level_id: 'l1' }];
    academicCache.setOptions(levels, departments);

    expect(academicCache.getOptions()).toEqual({ levels, departments });

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    expect(academicCache.getOptions()).toBeNull();
  });

  it('returns null for missing/corrupted options cache', async () => {
    const { academicCache } = await load<typeof import('../academic-utils')>('../academic-utils');
    expect(academicCache.getOptions()).toBeNull();

    localStorage.setItem('masarx_academic_options_cache', 'oops');
    expect(academicCache.getOptions()).toBeNull();
  });
});

describe('storage-cleanup — cleanupOldLocalStorage (T034)', () => {
  it('removes legacy prefix keys, exact keys and the migrated academic cache', async () => {
    const { cleanupOldLocalStorage } = await load<typeof import('../storage-cleanup')>(
      '../storage-cleanup',
    );

    localStorage.setItem('quiz_attempt_abc', 'attempt-1');
    localStorage.setItem('quiz_attempt_def', 'attempt-2');
    localStorage.setItem('quiz_history', 'history');
    localStorage.setItem('masarx_user_academic_cache', 'pii');
    localStorage.setItem('login_attempts', '3');
    localStorage.setItem('signup_attempts', '1');
    localStorage.setItem('masarx_user_academic_cache_new', 'keep-me'); // not a cleanup key

    cleanupOldLocalStorage();

    expect(localStorage.getItem('quiz_attempt_abc')).toBeNull();
    expect(localStorage.getItem('quiz_attempt_def')).toBeNull();
    expect(localStorage.getItem('quiz_history')).toBeNull();
    expect(localStorage.getItem('masarx_user_academic_cache')).toBeNull();
    expect(localStorage.getItem('login_attempts')).toBeNull();
    expect(localStorage.getItem('signup_attempts')).toBeNull();
    expect(localStorage.getItem('masarx_user_academic_cache_new')).toBe('keep-me');
  });

  it('is a no-op outside the browser and never throws on storage failures', async () => {
    const { cleanupOldLocalStorage } = await load<typeof import('../storage-cleanup')>(
      '../storage-cleanup',
    );
    expect(() => cleanupOldLocalStorage()).not.toThrow();

    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    localStorage.setItem('quiz_history', 'x');
    expect(() => cleanupOldLocalStorage()).not.toThrow();
    spy.mockRestore();
  });
});

describe('admin-shell/storage — readJSON/writeJSON', () => {
  it('round-trips JSON values', async () => {
    const { readJSON, writeJSON } = await load<typeof import('../admin-shell/storage')>(
      '../admin-shell/storage',
    );
    writeJSON('shell/prefs', { collapsed: true, tabs: [1, 2] });
    expect(readJSON('shell/prefs', { collapsed: false })).toEqual({ collapsed: true, tabs: [1, 2] });
  });

  it('returns the fallback for missing keys and corrupted JSON', async () => {
    const { readJSON } = await load<typeof import('../admin-shell/storage')>(
      '../admin-shell/storage',
    );
    expect(readJSON('missing', 'fallback')).toBe('fallback');

    localStorage.setItem('broken', '{nope');
    expect(readJSON('broken', 'fallback')).toBe('fallback');
  });

  it('applies the validation predicate and falls back on mismatch', async () => {
    const { readJSON, writeJSON } = await load<typeof import('../admin-shell/storage')>(
      '../admin-shell/storage',
    );
    const isStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((v) => typeof v === 'string');

    writeJSON('good', ['a']);
    expect(readJSON('good', [] as string[], isStringArray)).toEqual(['a']);

    writeJSON('bad', 'not an array');
    expect(readJSON('bad', [] as string[], isStringArray)).toEqual([]);
  });

  it('returns the fallback when localStorage is unavailable (SSR)', async () => {
    const { readJSON } = await load<typeof import('../admin-shell/storage')>(
      '../admin-shell/storage',
    );
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      expect(readJSON('key', 'fallback')).toBe('fallback');
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = originalWindow;
    }
  });

  it('writeJSON swallows quota/unavailable-storage errors', async () => {
    const { writeJSON } = await load<typeof import('../admin-shell/storage')>(
      '../admin-shell/storage',
    );
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeJSON('key', { a: 1 })).not.toThrow();
    spy.mockRestore();

    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      expect(() => writeJSON('key', { a: 1 })).not.toThrow();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = originalWindow;
    }
  });
});
