/**
 * Cookie-aware browser client for client components (SSR session sharing).
 *
 * Thin wrapper over the cross-platform factory in
 * `masarx-shared/supabase` — the same `createBrowserClient` construction
 * this file used to make directly, plus the factory's service-role JWT
 * guard and `client-info` header (contracts/supabase-client.md).
 *
 * Each call returns a fresh client (callers may hold it per-hook); for a
 * shared singleton use `@/lib/supabase` instead.
 */
import { createSupabaseClient } from "masarx-shared/supabase";

export function createClient() {
  return createSupabaseClient({
    runtime: "web",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.5.6",
  });
}
