/**
 * Network/request helpers for Supabase Edge Functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Client IP resolution, extracted verbatim (including comments) from the
 * three identical copies in reset-password, cloudinary-webhook and
 * request-password-reset.
 */
export const getClientIp = (req: Request): string => {
  // Priority: platform/CDN-injected headers (not client-controllable) BEFORE
  // x-forwarded-for, whose entries can be client-supplied.
  // 1) Cloudflare (fronts Supabase): overwrites CF-Connecting-IP with the
  //    real peer IP, so a spoofed value is replaced at the edge.
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  // 2) Supabase gateway trusted forwarded IP (when enabled platform-side).
  const sbIp = req.headers.get('sb-forwarded-for');
  if (sbIp) return sbIp.split(',')[0].trim();
  // 3) x-forwarded-for — first entry of the proxy chain (last resort).
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  // 4) nginx-style fallback.
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
};

export interface RateLimitOptions {
  identifier: string;
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

/**
 * Call the check_rate_limit RPC. Returns the RPC's `allowed` value
 * (`false` = exceeded; undefined on RPC error — callers keep their own
 * fail-open semantics and 429 response).
 */
export const checkRateLimit = async (
  client: SupabaseClient,
  { identifier, endpoint, maxRequests, windowMinutes }: RateLimitOptions,
): Promise<boolean | undefined> => {
  const { data: allowed } = await client.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_minutes: windowMinutes,
  });
  return allowed as boolean | undefined;
};
