import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security — use only
 * in trusted server contexts (Server Components, Route Handlers, Server
 * Actions) where you've already verified the caller.
 *
 * IMPORTANT: Never import this from a Client Component or ship
 * SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Typed loosely on purpose: Supabase JS v2's generic inference with the
 * project's Database type resolves Insert/Update to `never` in some
 * versions. Callers cast payloads at the call site (e.g.
 * `admin.from('profiles').insert(payload as never)`) — the runtime is
 * unaffected.
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      // Service role bypasses session — disable any persistence/refresh.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
};
