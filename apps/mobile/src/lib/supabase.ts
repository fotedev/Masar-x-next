/**
 * Mobile Supabase client - the single chokepoint for the Expo app.
 *
 * Implements the mobile half of
 * specs/004-multi-platform-expansion/contracts/supabase-client.md:
 *
 *   - The URL + anon key are resolved at build time from
 *     `expo-constants` -> `expoConfig.extra` (injected by app.config.js
 *     from EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
 *
 *   - The auth session is persisted through the injected
 *     SecureStoreAdapter (Keychain on iOS, EncryptedSharedPreferences on
 *     Android) - the factory refuses `runtime: "mobile"` without one.
 *
 *   - Only the public anon key is ever referenced here (spec FR-017):
 *     the service-role key must never appear in any client config.
 *
 * Edge case (spec): if Supabase env vars are missing on first launch the
 * app must show a clear "cannot reach Masar X right now" state, not
 * crash. `isSupabaseConfigured` drives that screen; `getSupabaseClient()`
 * throws a descriptive error only if a consumer ignores it.
 */
import Constants from "expo-constants";

import {
  createSupabaseClient,
  type SupabaseClient,
  type SupabaseStorageAdapter,
} from "masarx-shared/supabase";

import {
  secureStoreGetText,
  secureStoreRemoveText,
  secureStoreSetText,
} from "./secure-store-text";

interface MasarxExtra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export const SUPABASE_URL: string =
  ((Constants.expoConfig?.extra ?? {}) as MasarxExtra).supabaseUrl ?? "";
export const SUPABASE_ANON_KEY: string =
  ((Constants.expoConfig?.extra ?? {}) as MasarxExtra).supabaseAnonKey ?? "";

export const MISSING_SUPABASE_ENV_VARS: string[] = [
  ...(SUPABASE_URL ? [] : ["EXPO_PUBLIC_SUPABASE_URL"]),
  ...(SUPABASE_ANON_KEY ? [] : ["EXPO_PUBLIC_SUPABASE_ANON_KEY"]),
];

export const isSupabaseConfigured: boolean = MISSING_SUPABASE_ENV_VARS.length === 0;

/**
 * Supabase auth storage adapter backed by expo-secure-store. supabase-js
 * stringifies the session itself; we only move (possibly chunked) strings
 * in and out of the Keychain / EncryptedSharedPreferences.
 */
export const SecureStoreAdapter: SupabaseStorageAdapter = {
  getItem: (key: string) => secureStoreGetText(key),
  setItem: (key: string, value: string) => secureStoreSetText(key, value),
  removeItem: (key: string) => secureStoreRemoveText(key),
};

let client: SupabaseClient | null = null;

/**
 * Lazily construct the shared Supabase client (the app calls this exactly
 * once per launch, on first access, per the contract). Throws a clear,
 * env-var-listing error when the app was built without configuration.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Masar X cannot reach its backend: the app was built without " +
        `${MISSING_SUPABASE_ENV_VARS.join(" and ")}. ` +
        "Set them in .env.local (local dev: `pnpm --filter mobile start`) or as EAS " +
        "secret environment variables (cloud builds), then rebuild. " +
        "Only the public anon key is required - never the service-role key.",
    );
  }
  if (!client) {
    client = createSupabaseClient({
      runtime: "mobile",
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      storage: SecureStoreAdapter,
      appVersion: Constants.expoConfig?.version ?? "0.0.0",
    });
  }
  return client;
}