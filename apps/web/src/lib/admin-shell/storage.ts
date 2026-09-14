/**
 * Crash-proof, SSR-safe localStorage helpers (admin shell scope).
 *
 * Every operation degrades to a safe fallback instead of throwing:
 * private mode, quota errors, corrupted JSON, and server rendering all
 * resolve to `fallback` rather than an exception.
 */

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

/** Read + JSON.parse with an optional validation predicate. Never throws. */
export function readJSON<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  try {
    if (!isBrowser()) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate ? validate(parsed) : true) return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
}

/** JSON.stringify + write. Never throws (persistence is best-effort). */
export function writeJSON(key: string, value: unknown): void {
  try {
    if (isBrowser()) window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best-effort persistence */
  }
}