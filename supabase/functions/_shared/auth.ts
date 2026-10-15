/**
 * Auth + client scaffolding for Supabase Edge Functions.
 *
 * Two halves in one module:
 * - `getBearerToken` (pure, unit-tested): extracts the raw token from
 *   `Authorization: Bearer <token>`, else null. `verify_jwt = true` alone
 *   is NOT sufficient (the anon key is itself a valid JWT), so every
 *   function must additionally resolve the token to a real user via
 *   `auth.getUser()` and reject when no user comes back.
 * - `requireUser` / `createAdminClient`: anon-key client with the caller's
 *   token forwarded (deduped from the scaffold previously cloned across
 *   delete-avatar, delete-file and upload-avatar), plus the standard 401
 *   JSON response. Missing/malformed credentials yield 401, never a 500.
 */
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

/** Extract the raw token from `Authorization: Bearer <token>`, else null. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export type AuthOutcome =
  | { client: SupabaseClient; user: { id: string }; response?: undefined }
  | { client?: undefined; user?: undefined; response: Response };

/**
 * Resolve the caller's user or produce the standard 401 response.
 * Callers: `const auth = await requireUser(req); if (auth.response) return auth.response;`
 */
export const requireUser = async (req: Request): Promise<AuthOutcome> => {
  const token = getBearerToken(req);
  if (!token) {
    return { response: jsonResponse(req, { error: "Unauthorized" }, 401) };
  }
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  );
  const { data: { user } } = await client.auth.getUser(token);

  if (!user) {
    return { response: jsonResponse(req, { error: "Unauthorized" }, 401) };
  }
  return { client, user };
};

/** Service-role client (callers with unique env guards keep them). */
export const createAdminClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
