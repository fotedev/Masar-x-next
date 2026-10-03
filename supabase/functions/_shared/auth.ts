/**
 * Auth + client scaffolding for Supabase Edge Functions.
 *
 * `createUserClient`/`requireUser` are extracted verbatim from the scaffold
 * that was cloned across delete-avatar, delete-file and upload-avatar
 * (anon-key client with the caller's Authorization header forwarded, then
 * `auth.getUser(token)` and a 401 JSON response when absent).
 */
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

export type AuthOutcome =
  | { client: SupabaseClient; user: { id: string }; response?: undefined }
  | { client?: undefined; user?: undefined; response: Response };

/** Anon-key client that forwards the caller's Authorization header. */
export const createUserClient = (req: Request): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

/**
 * Resolve the caller's user or produce the standard 401 response.
 * Callers: `const auth = await requireUser(req); if (auth.response) return auth.response;`
 */
export const requireUser = async (req: Request): Promise<AuthOutcome> => {
  const client = createUserClient(req);
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await client.auth.getUser(token);

  if (!user) {
    return { response: jsonResponse(req, { error: "Unauthorized" }, 401) };
  }
  return { client, user };
};

/** Service-role client (no env guard — callers with unique guards keep them). */
export const createAdminClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
