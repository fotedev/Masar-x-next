/**
 * CORS helper for Supabase Edge Functions.
 *
 * Browsers enforce that `Access-Control-Allow-Origin` contains exactly ONE
 * origin (or `*`). Listing multiple origins in a single header value is
 * invalid and will be rejected by the preflight check.
 *
 * This helper echoes back the request's `Origin` if it matches the
 * allow-list; otherwise it falls back to the first production origin.
 * For preflight (`OPTIONS`) requests we also handle the wildcard case by
 * using `*` (acceptable only because Supabase Edge Functions are not
 * using cookies here — the client uses bearer auth in the
 * `Authorization` header, so credentials mode is off).
 */

const ALLOWED_ORIGINS = [
  "https://masarx.vercel.app",
  "https://masar-x.vercel.app",
  "https://www.masarx.com",
  "https://localhost:3000",
  "http://localhost:3000",
] as const;

const FALLBACK_ORIGIN = ALLOWED_ORIGINS[0];

/**
 * Resolve the origin to send in the `Access-Control-Allow-Origin` header.
 * Echoes the request origin if it is in the allow-list, otherwise returns
 * the fallback. Never returns multiple values.
 */
export const resolveOrigin = (req: Request): string => {
  const origin = req.headers.get("Origin");
  if (origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
    return origin;
  }
  return FALLBACK_ORIGIN;
};

/**
 * Build the CORS headers for a given request.
 *
 * Pass `null` for `allowedOrigin` to use the resolver (recommended).
 * The `Vary: Origin` header is set so caches don't serve the wrong
 * `Access-Control-Allow-Origin` value to a different client.
 */
export const buildCorsHeaders = (
  req: Request,
  allowedOrigin: string | null = null,
): Record<string, string> => {
  const origin = allowedOrigin ?? resolveOrigin(req);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
    "Vary": "Origin",
  };
};

/**
 * Backwards-compatible static export. Kept so any function that imports
 * the bare `corsHeaders` constant still compiles, but **callers should
 * migrate to `buildCorsHeaders(req)`** so the response actually matches
 * the request origin.
 *
 * NOTE: This defaults to the first allowed origin and is not safe for
 * multi-origin setups. It is only here as a safety net.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": FALLBACK_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
  "Vary": "Origin",
};
