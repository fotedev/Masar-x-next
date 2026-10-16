/**
 * HTTP helpers for Supabase Edge Functions.
 *
 * Extracted from the per-function boilerplate that was duplicated in every
 * function: the OPTIONS preflight guard and the JSON Response shape
 * (`{ ...buildCorsHeaders(req), 'Content-Type': 'application/json' }`).
 * Behavior is byte-equivalent to the inline originals.
 */
import { buildCorsHeaders } from "./cors.ts";

/** Standard preflight reply — identical in every function. */
export const corsPreflight = (req: Request): Response =>
  new Response("ok", { headers: buildCorsHeaders(req) });

/**
 * JSON response with CORS headers. Callers that need extra headers
 * (e.g. the webhook's `Allow` header on 405) pass them last.
 */
export const jsonResponse = (
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

/**
 * Shared OPTIONS preflight + POST-only guard, deduped from the identical
 * preamble previously cloned in cloudinary-webhook and
 * request-password-reset. Returns a Response to send immediately, or null
 * to continue handling. Extra headers (e.g. the webhook's `Allow` header
 * on 405) pass through last.
 */
export const methodGuard = (
  req: Request,
  extra405Headers: Record<string, string> = {},
): Response | null => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, extra405Headers);
  }
  return null;
};
