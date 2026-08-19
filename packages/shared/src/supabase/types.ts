/**
 * Public type surface for `packages/shared/src/supabase/`.
 *
 * Mirrors the contract in
 * `specs/004-multi-platform-expansion/contracts/supabase-client.md`:
 * the factory exports `createSupabaseClient` and a `SupabaseClientOptions`
 * shape; the implementation is in `./index.ts` and routes the runtime
 * to the correct underlying client (browser, server, or — once US2
 * lands — the mobile/secure-store adapter).
 *
 * We re-export the relevant pieces of `@supabase/supabase-js` here
 * (the `SupabaseClient` type) so apps can write
 * `import type { SupabaseClient } from "@masarx-shared/supabase"`
 * without pulling in the heavy `@supabase/supabase-js` types at their
 * own import sites.
 */
import type { SupabaseClient as RawSupabaseClient } from "@supabase/supabase-js";

export type SupabaseRuntime = "web" | "desktop" | "mobile";

export type SupabaseClient = RawSupabaseClient;

/**
 * Storage adapter for persisting the auth session.
 *
 * The default per runtime:
 *   - web: cookies (existing behavior; the factory leaves storage undefined
 *     and the caller is expected to pass a cookie-based adapter if it needs
 *     server-side rendering parity).
 *   - desktop: encrypted file in the Electron userData dir (US1 / T021).
 *   - mobile: expo-secure-store (US2 / T032).
 *
 * In v1 only the "web" path is implemented; the desktop and mobile
 * adapters are added in their respective user-story phases.
 */
export interface SupabaseStorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface SupabaseClientOptions {
  runtime: SupabaseRuntime;
  /**
   * The Supabase project URL. Resolved at build time per runtime:
   *   - web: process.env.NEXT_PUBLIC_SUPABASE_URL
   *   - desktop: read from the app manifest (build-time constant) — T019
   *   - mobile: expo-constants.expoConfig.extra.supabaseUrl — T029
   */
  url: string;
  /**
   * The Supabase anon key. Same resolution rules as `url`.
   * MUST be the anon key, NEVER the service role key.
   */
  anonKey: string;
  /**
   * Optional: storage adapter for persisting the auth session.
   */
  storage?: SupabaseStorageAdapter;
  /**
   * App version string for the `client-info` header.
   * Defaults to `"0.0.0"` if not provided; the real version comes
   * from the consuming app's `package.json`.
   */
  appVersion?: string;
}
