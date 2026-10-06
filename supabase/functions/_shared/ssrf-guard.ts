/**
 * SSRF guard for Edge Functions (P0 hotfix for process-pdf).
 *
 * Defense layers for any server-side fetch() of a caller-supplied URL:
 *   1. Scheme/host/port allowlisting (pure, unit-tested here).
 *   2. IP-literal and private-range rejection incl. IPv4-mapped IPv6 (pure).
 *   3. DNS resolution + per-answer validation in the handler (async, uses
 *      Deno.resolveDns; fail-closed). TOCTOU between resolve and connect is a
 *      documented residual (see index.ts); manual redirect handling +
 *      re-validation on every hop narrows it.
 *
 * Pure functions only (no Deno / network imports) so they run under
 * `deno test` with zero dependencies.
 */

export interface FetchUrlPolicy {
  /** Exact hostnames allowed (lowercase comparison). No wildcards. */
  allowedHosts: string[];
  /** Reject non-default ports when true (default true). */
  rejectNonDefaultPort?: boolean;
}

export type UrlVerdict =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/** Strict dotted-decimal IPv4 -> 32-bit int, else null. */
export function parseIPv4(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    // Reject leading-zero octal ambiguity ("0177.0.0.1").
    if (p.length > 1 && p.startsWith("0")) return null;
    const v = Number(p);
    if (v > 255) return null;
    num = num * 256 + v;
  }
  return num;
}

function inCidr(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ip & mask) >>> 0) === ((base & mask) >>> 0);
}

/** True for any non-public IPv4: private, loopback, link-local, CGNAT, reserved. */
export function isNonPublicIPv4(ip: number): boolean {
  const u = ip >>> 0;
  const ranges: Array<[number, number]> = [
    [0x00000000, 8], // 0.0.0.0/8 (this network)
    [0x0a000000, 8], // 10.0.0.0/8
    [0x64400000, 10], // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 8], // 127.0.0.0/8 (loopback)
    [0xa9fe0000, 16], // 169.254.0.0/16 (link-local + cloud metadata)
    [0xac100000, 12], // 172.16.0.0/12
    [0xc0000000, 24], // 192.0.0.0/24 (IETF protocol assignments)
    [0xc0000200, 24], // 192.0.2.0/24 (TEST-NET-1)
    [0xc0586300, 24], // 192.88.99.0/24 (6to4 relay, deprecated)
    [0xc0a80000, 16], // 192.168.0.0/16
    [0xc6120000, 15], // 198.18.0.0/15 (benchmarking)
    [0xc6336400, 24], // 198.51.100.0/24 (TEST-NET-2)
    [0xcb007100, 24], // 203.0.113.0/24 (TEST-NET-3)
    [0xe0000000, 4], // 224.0.0.0/4 (multicast)
    [0xf0000000, 4], // 240.0.0.0/4 (reserved + broadcast)
  ];
  return ranges.some(([base, bits]) => inCidr(u, base, bits));
}

/** Expand an IPv6 literal to 8 hextets, else null. Handles "::" and rejects zones. */
export function expandIPv6(text: string): string[] | null {
  let s = text.toLowerCase();
  if (s.includes("%")) return null; // zone id
  // Embedded IPv4 (e.g. ::ffff:127.0.0.1): rewrite the tail as two hextets
  // so the normal expansion below handles it (no special group accounting).
  const v4tail = s.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const v4 = parseIPv4(v4tail[1]);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = s.slice(0, s.length - v4tail[1].length) + `${hi}:${lo}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] === "" ? [] : halves[0].split(":");
  const right = halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  const all = [...left, ...right];
  for (const g of all) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
  }
  if (halves.length === 1) {
    if (all.length !== 8) return null;
    return all;
  }
  const missing = 8 - all.length;
  if (missing <= 0) return null;
  return [...left, ...Array<string>(missing).fill("0"), ...right];
}

/** True for ::1, ::, ULA fc00::/7, link-local fe80::/10, or mapped non-public v4. */
export function isNonPublicIPv6(groups: string[]): boolean {
  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.every((n) => n === 0)) return true; // ::
  if (nums.slice(0, 7).every((n) => n === 0) && nums[7] === 1) return true; // ::1
  // ::ffff:0:0/96 IPv4-mapped -> judge by the embedded v4 address.
  if (nums.slice(0, 5).every((n) => n === 0) && nums[5] === 0xffff) {
    const v4 = ((nums[6] << 16) | nums[7]) >>> 0;
    return isNonPublicIPv4(v4);
  }
  const first = nums[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/**
 * Validate a caller-supplied URL for server-side fetch.
 * Rejects: non-https, credentials, non-default ports (default), IP literals,
 * hosts outside the allowlist. DNS answers are validated separately via
 * `isAllowedDnsAnswer` in the handler (async).
 */
export function validateFetchUrl(raw: string, policy: FetchUrlPolicy): UrlVerdict {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return { ok: false, reason: "bad-url" };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "bad-url" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (url.username !== "" || url.password !== "") return { ok: false, reason: "credentials" };
  const rejectPort = policy.rejectNonDefaultPort !== false;
  if (rejectPort && url.port !== "") return { ok: false, reason: "port" };
  let host = url.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.length === 0) return { ok: false, reason: "host" };
  // IP literals are never fetchable: the allowlist holds DNS names only.
  const v4 = parseIPv4(host);
  if (v4 !== null) return { ok: false, reason: "ip-literal" };
  if (host.includes(":")) {
    const groups = expandIPv6(host.replace(/^\[(.*)\]$/, "$1"));
    if (groups === null) return { ok: false, reason: "bad-ipv6" };
    return { ok: false, reason: "ip-literal" };
  }
  const allowed = policy.allowedHosts.some((h) => h.toLowerCase() === host);
  if (!allowed) return { ok: false, reason: "host-allowlist" };
  return { ok: true, url };
}

/**
 * Validate one DNS answer (raw A/AAAA string) for a host that already passed
 * `validateFetchUrl`. Returns false for anything non-public. Fail-closed.
 */
export function isAllowedDnsAnswer(answer: string): boolean {
  const v4 = parseIPv4(answer.trim());
  if (v4 !== null) return !isNonPublicIPv4(v4);
  const groups = expandIPv6(answer.trim().replace(/^\[(.*)\]$/, "$1"));
  if (groups === null) return false;
  return !isNonPublicIPv6(groups);
}

/** Resolve a redirect Location against the current URL; null when unusable. */
export function resolveRedirectTarget(location: string | null, current: URL): string | null {
  if (!location) return null;
  try {
    return new URL(location, current.toString()).toString();
  } catch {
    return null;
  }
}
