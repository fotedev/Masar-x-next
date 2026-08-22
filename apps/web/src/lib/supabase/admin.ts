import "server-only";

import { createClient } from "@supabase/supabase-js";
import { stripBOM } from "./utils";

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
 *
 * Env-var BOM strip: `process.env.*` values are read from the runtime
 * env (Vercel project settings, local .env, etc.). If any of them was
 * pasted with a leading U+FEFF (e.g. from a copy/paste round-trip through
 * a terminal or editor), the SDK would forward that byte to undici
 * via the `apikey` / `Authorization` header, and undici would throw
 * `TypeError: Cannot convert argument to a ByteString because the
 * character at index 0 has a value of 65279`. `stripBOM` is a no-op
 * for clean values.
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
  if (adminClient) return adminClient;

  const url = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const serviceKey = stripBOM(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

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
