/**
 * Loopback-host classification + the desktop Host guard (spec 041 R18).
 *
 * The Electron desktop serves this app from a loopback Next standalone
 * server. A DNS-rebinding page could reach `127.0.0.1:<port>` with an
 * attacker-chosen Host header, and the standalone server does no Host
 * validation of its own. In desktop mode — marked by
 * MASARX_DESKTOP_LOOPBACK=1, set by apps/desktop/src/main/server.ts at
 * spawn — apps/web/src/proxy.ts rejects any request whose Host is not
 * loopback, failing closed when the Host header is missing.
 *
 * The env marker is read at request time; the Vercel deployment and
 * `next dev` never see it, so they are untouched.
 */

/**
 * Loopback-host classification. Extracted from proxy.ts (was inline there
 * for the CSP upgrade-insecure-requests suppression) so both the CSP logic
 * and the desktop Host guard share one implementation.
 */
export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();

  // IPv6 loopback — the Host header for an IPv6 literal is bracketed and
  // has the port after the closing bracket: `[::1]:3000`. Strip the
  // bracketed part first, then check the literal. We also accept a bare
  // `::1` (non-conformant per RFC 9110, but some clients send it that
  // way and treating it as loopback is the safer default).
  if (lower.startsWith("[")) {
    const end = lower.indexOf("]");
    if (end < 0) return false;
    const literal = lower.slice(1, end);
    if (literal === "::1") return true;
    return false;
  }
  if (lower === "::1") return true;

  // Strip the port for IPv4 / hostname (Host is `hostname[:port]` per RFC 9110).
  const hostname = lower.split(":", 1)[0] ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  // IPv4 loopback range 127.0.0.0/8.
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  return false;
}

/**
 * True when the request must be rejected with 403. Only active in desktop
 * mode; outside it (Vercel, next dev) everything passes through.
 */
export function isDesktopHostForbidden(host: string | null): boolean {
  if (process.env.MASARX_DESKTOP_LOOPBACK !== "1") return false;
  // Missing Host fails closed.
  return !isLocalHost(host);
}
