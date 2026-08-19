/**
 * Heuristic detection of a `service_role` JWT.
 *
 * Per `specs/004-multi-platform-expansion/contracts/supabase-client.md`:
 *
 *   "Hard guarantee: createSupabaseClient MUST throw if `anonKey` matches
 *    the shape of a service-role JWT (heuristic: role claim === 'service_role').
 *    This is a build-time / startup-time guard, not a runtime per-request check."
 *
 * A Supabase JWT has the shape `header.payload.signature` (three
 * base64url-encoded sections separated by `.`). We decode the payload
 * without verifying the signature (this is a shape check, not an
 * authentication check — the real auth is the network call to the
 * Supabase project, which the RLS policies enforce) and read the
 * `role` claim. If it equals `"service_role"`, the caller is trying
 * to ship the service-role key to a client context; the factory
 * MUST refuse to construct a client.
 *
 * This is intentionally a heuristic, not a cryptographic check.
 * A future contributor who wants to bypass it with a freshly minted
 * service-role JWT will get caught by gitleaks on the built artifact
 * (T015) and by the AI provider key pattern (T008 / `.gitleaks.toml`).
 */
export function looksLikeServiceRoleJwt(key: string): boolean {
  if (typeof key !== "string" || key.length === 0) return false;

  const parts = key.split(".");
  if (parts.length !== 3) return false;

  // Base64url decode the payload (middle section).
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "===".slice((payload.length + 3) % 4);

  try {
    // Node 18+ provides `atob`; we use Buffer for portability and to
    // avoid pulling in a polyfill in the browser bundle.
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return parsed?.role === "service_role";
  } catch {
    return false;
  }
}
