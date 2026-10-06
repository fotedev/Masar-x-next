/**
 * Bearer-token extraction for Edge Functions (P0 hotfix support).
 *
 * `verify_jwt = true` alone is NOT sufficient: the anon key is itself a valid
 * JWT, so every function must additionally resolve the token to a real user
 * via `auth.getUser()` and reject when no user comes back. This module holds
 * the pure, unit-tested half (header parsing); the getUser() half stays in
 * each function with its Supabase client.
 *
 * Pure functions only (no Deno / network imports).
 */

/** Extract the raw token from `Authorization: Bearer <token>`, else null. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}
