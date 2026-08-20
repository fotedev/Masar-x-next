/**
 * ipc-supabase-storage.ts — Renderer-side adapter for the desktop runtime
 *
 * Spec: specs/004-multi-platform-expansion/tasks.md §T021
 * Contract: specs/004-multi-platform-expansion/contracts/supabase-client.md
 *
 * Bridges the `@supabase/supabase-js` storage interface (per-key
 * getItem/setItem/removeItem) to the main-process IPC channels
 * (auth:getSession, auth:setSession, auth:signOut, auth:changed).
 *
 * The Supabase auth client only ever touches one storage key
 * (`storageKey`, default `sb-<project>-auth-token`). This adapter:
 *   1. On first `getItem(key)`, fetches the whole session from main
 *      via `auth:getSession` and caches it in `cache` keyed by the
 *      Supabase storageKey.
 *   2. On `setItem(key, value)`, updates the cache and forwards the
 *      parsed Session to main via `auth:setSession`.
 *   3. On `removeItem(key)`, clears the cache and calls `auth:signOut`.
 *   4. Subscribes to `auth:changed` from main so multi-window sync
 *      invalidates the cache (v1: single window; the wire is in place).
 */

import type { SupabaseStorageAdapter } from 'masarx-shared/supabase';

/**
 * Minimal shape of the IPC bridge exposed by preload.ts. We type it
 * structurally to avoid pulling `electron` into the renderer bundle
 * (the renderer's `window` already has it via contextBridge).
 */
interface MasarxDesktopIpcBridge {
  auth: {
    getSession(): Promise<unknown>;
    setSession(session: unknown): Promise<void>;
    signOut(): Promise<void>;
    onChange(cb: (event: unknown) => void): () => void;
  };
}

declare global {
  interface Window {
    masarxDesktop?: MasarxDesktopIpcBridge;
  }
}

const SESSION_KEY = 'masarx-desktop-session';

export function createIpcSupabaseStorage(): SupabaseStorageAdapter {
  const bridge = window.masarxDesktop;
  if (!bridge) {
    throw new Error(
      'createIpcSupabaseStorage: `window.masarxDesktop` is not defined. ' +
        'This adapter only works inside the Electron desktop runtime.',
    );
  }

  // In-memory cache. The Supabase client treats the storage as the
  // source of truth for `getSession` between calls; we round-trip the
  // whole session once at startup and keep it in sync via `onChange`.
  const cache = new Map<string, string>();
  let hydrated = false;

  const hydrate = async (): Promise<void> => {
    if (hydrated) return;
    hydrated = true;
    try {
      const session = await bridge.auth.getSession();
      if (session && typeof session === 'object') {
        // Wrap the session in the envelope the Supabase client expects.
        // The auth client uses a single key whose value is the JSON-encoded
        // `{ currentSession, expiresAt }` shape. We just stash the whole
        // object as the value; the client will JSON.parse it.
        cache.set(SESSION_KEY, JSON.stringify({ currentSession: session }));
      }
    } catch {
      // Hydration failure is non-fatal; the user just signs in fresh.
    }
  };

  // Subscribe to main-process changes (multi-window sync, future-proof).
  bridge.auth.onChange((session) => {
    if (session === null) {
      cache.delete(SESSION_KEY);
    } else {
      cache.set(SESSION_KEY, JSON.stringify({ currentSession: session }));
    }
  });

  return {
    async getItem(key: string): Promise<string | null> {
      // Only the session key is supported on desktop. Any other key the
      // client probes is unknown to us; return null so the client
      // re-derives it from the in-memory state.
      if (key !== SESSION_KEY) {
        return null;
      }
      await hydrate();
      return cache.get(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
      if (key !== SESSION_KEY) return;
      cache.set(key, value);
      // Persist to main. Parse the value back to a Session; the Supabase
      // client writes the same JSON envelope it reads.
      try {
        const parsed = JSON.parse(value) as { currentSession?: unknown };
        const session = parsed.currentSession;
        if (session && typeof session === 'object') {
          await bridge.auth.setSession(session);
        }
      } catch {
        // Malformed value; ignore (the client's invariant is broken).
      }
    },

    async removeItem(key: string): Promise<void> {
      if (key !== SESSION_KEY) return;
      cache.delete(key);
      await bridge.auth.signOut();
    },
  };
}
