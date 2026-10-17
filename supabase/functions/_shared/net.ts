/**
 * Network/request helpers for Supabase Edge Functions.
 */

/**
 * Client IP resolution.
 *
 * Priority: platform/CDN-injected headers (not client-controllable) BEFORE
 * x-forwarded-for, whose entries can be client-supplied.
 * 1) Cloudflare (fronts Supabase): overwrites CF-Connecting-IP with the
 *    real peer IP, so a spoofed value is replaced at the edge.
 * 2) Supabase gateway trusted forwarded IP (when enabled platform-side).
 * 3) x-forwarded-for — first entry of the proxy chain (last resort).
 * 4) nginx-style fallback.
 */
const IP_HEADERS: Array<{ name: string; firstHopOnly: boolean }> = [
  { name: "cf-connecting-ip", firstHopOnly: false },
  { name: "sb-forwarded-for", firstHopOnly: true },
  { name: "x-forwarded-for", firstHopOnly: true },
  { name: "x-real-ip", firstHopOnly: false },
];

export const getClientIp = (req: Request): string => {
  for (const { name, firstHopOnly } of IP_HEADERS) {
    const raw = req.headers.get(name);
    if (!raw) continue;
    return firstHopOnly ? raw.split(",")[0].trim() : raw.trim();
  }
  return "unknown";
};

export interface RateLimitOptions {
  identifier: string;
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

/** Minimal RPC surface checkRateLimit needs (keeps this helper decoupled
 * from the SupabaseClient generics, whose bare instantiation does not
 * accept concrete rpc args). */
export interface RateLimitRpc {
  rpc(
    fn: string,
    args: {
      p_identifier: string;
      p_endpoint: string;
      p_max_requests: number;
      p_window_minutes: number;
    },
  ): PromiseLike<{ data: unknown }>;
}

/**
 * Call the check_rate_limit RPC. Returns the RPC's `allowed` value
 * (`false` = exceeded; undefined on RPC error — callers keep their own
 * fail-open semantics and 429 response).
 */
export const checkRateLimit = async (
  client: RateLimitRpc,
  { identifier, endpoint, maxRequests, windowMinutes }: RateLimitOptions,
): Promise<boolean | undefined> => {
  const { data: allowed } = await client.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_minutes: windowMinutes,
  });
  return typeof allowed === "boolean" ? allowed : undefined;
};
