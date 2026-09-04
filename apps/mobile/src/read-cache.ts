/**
 * LocalReadCache (mobile) - per
 * specs/004-multi-platform-expansion/data-model.md:
 *
 *   "LocalReadCache ... Mobile: AsyncStorage with a JSON envelope; the
 *    data volume is small for v1.
 *    Key attributes (per cache entry): key (e.g. study_summary:{id}),
 *    value (the row), cached_at, expires_at."
 *
 * Every entry is stored as an envelope:
 *
 *   { version, savedAt, ttlHours, payload }
 *
 * The read-through lifecycle (render cache instantly, refresh in the
 * background when online) lives in src/hooks/useSupabaseQuery.ts; this
 * module is deliberately dumb storage + TTL arithmetic.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "masarx_read_cache_";

export const CACHE_VERSION = 1 as const;

/** One week - long enough for offline study, short enough to stay fresh-ish. */
export const DEFAULT_TTL_HOURS = 168;

export interface CacheEnvelope<T> {
  version: typeof CACHE_VERSION;
  savedAt: string;
  ttlHours: number;
  payload: T;
}

export interface CacheHit<T> {
  payload: T;
  savedAt: string;
  /** True when the entry is older than its TTL (still readable offline). */
  isStale: boolean;
}

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export async function cacheSet<T>(
  key: string,
  payload: T,
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    ttlHours,
    payload,
  };
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    // AsyncStorage can reject on quota/disk errors; the read cache is
    // best-effort by design and must never break the online path.
  }
}

export async function cacheGet<T>(key: string): Promise<CacheHit<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== CACHE_VERSION) return null;
    const savedAtMs = new Date(parsed.savedAt).getTime();
    const isStale =
      Number.isFinite(savedAtMs) &&
      Date.now() - savedAtMs > parsed.ttlHours * 60 * 60 * 1000;
    return { payload: parsed.payload, savedAt: parsed.savedAt, isStale };
  } catch {
    return null;
  }
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch {
    // Best-effort.
  }
}

/** Development / sign-out hygiene helper: drop every read-cache entry. */
export async function cacheClearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Best-effort.
  }
}