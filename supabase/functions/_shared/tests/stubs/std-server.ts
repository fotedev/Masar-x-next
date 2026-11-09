/**
 * Offline test double for the deno_std http server module (serve only).
 * Captures every handler passed to serve() on
 * `globalThis.__SERVED_HANDLERS__` so handler-level tests can import a
 * function's index.ts and drive the real serve() callback without network.
 */
export function serve(handler: unknown): void {
  const g = globalThis as unknown as { __SERVED_HANDLERS__?: unknown[] };
  g.__SERVED_HANDLERS__ = g.__SERVED_HANDLERS__ ?? [];
  g.__SERVED_HANDLERS__.push(handler);
}
