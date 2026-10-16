/**
 * Auth + client scaffolding for Supabase Edge Functions.
 *
 * Two halves in one module:
 * - `getBearerToken` (pure, unit-tested): extracts the raw token from
 *   `Authorization: Bearer <token>`, else null. `verify_jwt = true` alone
 *   is NOT sufficient (the anon key is itself a valid JWT), so every
 *   function must additionally resolve the token to a real user via
 *   `auth.getUser()` and reject when no user comes back.
 * - `requireUser` / `createAdminClient` / `withAuthedJson`: anon-key
 *   client with the caller's token forwarded (deduped from the scaffold
 *   previously cloned across delete-avatar, delete-file and upload-avatar),
 *   plus the standard 401 JSON response. Missing/malformed credentials
 *   yield 401, never a 500.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { corsPreflight, jsonResponse } from "./http.ts";

// Structural client type derived from the factory (the offline test stub
// exports createClient but no SupabaseClient nominal type).
type SupabaseClient = ReturnType<typeof createClient>;

/** Extract the raw token from `Authorization: Bearer <token>`, else null. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

type AuthOutcome =
  | { client: SupabaseClient; user: { id: string }; response?: undefined }
  | { client?: undefined; user?: undefined; response: Response };

const unauthorized = (req: Request): AuthOutcome => ({
  response: jsonResponse(req, { error: "Unauthorized" }, 401),
});

const buildUserClient = (token: string): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  );

/**
 * Resolve the caller's user or produce the standard 401 response.
 * Used by withAuthedJson below (module-internal since the wrapper
 * superseded direct use).
 */
const requireUser = async (req: Request): Promise<AuthOutcome> => {
  const token = getBearerToken(req);
  if (!token) return unauthorized(req);
  const client = buildUserClient(token);
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return unauthorized(req);
  return { client, user };
};

/** Service-role client (callers with unique env guards keep them). */
export const createAdminClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

export interface AuthedJsonContext<T> {
  user: { id: string };
  client: SupabaseClient;
  body: T;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

/**
 * Shared OPTIONS + auth + JSON-body preamble for the upload-style
 * functions (delete-file, upload-avatar). `logPrefix` names the function
 * in the 500-path log line; the response shape is identical for every
 * caller (the pre-existing per-function behavior, now in one place).
 */
export const withAuthedJson = async <T>(
  req: Request,
  logPrefix: string,
  handle: (ctx: AuthedJsonContext<T>) => Promise<Response>,
): Promise<Response> => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const { user, client } = auth;
    const body = (await req.json()) as T;
    return await handle({ user, client, body });
  } catch (error) {
    console.error(`${logPrefix} error:`, error);
    return jsonResponse(req, { error: "Internal server error", details: errorMessage(error) }, 500);
  }
};
