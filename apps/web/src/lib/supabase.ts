/**
 * Supabase browser client.
 *
 * In Spec 004 Phase 2 (T010), this file became a thin wrapper that
 * routes through the cross-platform factory in
 * `packages/shared/src/supabase/`. The factory enforces the
 * `service_role` JWT guard and the `client-info` header injection
 * described in `specs/004-multi-platform-expansion/contracts/supabase-client.md`.
 *
 * Existing app code imports `supabase` from this module — that
 * import surface is preserved so no consumer file needs to change.
 * New code SHOULD import `createSupabaseClient` from
 * `@masarx-shared/supabase` directly.
 */
import { createSupabaseClient } from "masarx-shared/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createSupabaseClient({
  runtime: "web",
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.5.6",
});
