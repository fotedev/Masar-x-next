#!/usr/bin/env node
// ============================================================================
// scripts/csp-smoke.mjs — host-aware CSP regression check
//
// Background: `apps/web/src/middleware.ts` adds a Content-Security-Policy
// header to every response. The `upgrade-insecure-requests` directive
// forces the browser to upgrade any sub-resource from HTTP to HTTPS. That
// is correct for the production Vercel deployment (real HTTPS domain) but
// it breaks the Electron desktop runtime, where the local Next.js server
// is plain HTTP on `127.0.0.1:<port>`. The CSP was changed to omit the
// directive for loopback hosts (`127.0.0.1`, `localhost`, IPv6 `::1`,
// any `127.x.x.x`).
//
// This script re-implements the same `isLocalHost` logic that the
// middleware uses and asserts the directive is dropped for local hosts
// and kept for the production domain. It runs without a test framework
// (no vitest config in apps/web) so it can be invoked from CI via
// `node apps/web/scripts/csp-smoke.mjs`.
//
// Note: this only checks the regex/conditional logic, not the full
// middleware flow (which requires a running Next.js server). The full
// integration assertion is manual: open the dev server with
// `Host: 127.0.0.1:3000` and verify the response header.
// ============================================================================

function isLocalHost(host) {
  if (!host) return false;
  const lower = host.toLowerCase();
  if (lower.startsWith("[")) {
    const end = lower.indexOf("]");
    if (end < 0) return false;
    const literal = lower.slice(1, end);
    if (literal === "::1") return true;
    return false;
  }
  if (lower === "::1") return true;
  const hostname = lower.split(":", 1)[0] || "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  return false;
}

function shouldIncludeUpgradeInsecureRequests(host) {
  return !isLocalHost(host);
}

const cases = [
  { host: "127.0.0.1:1657", expect: false, label: "desktop loopback" },
  { host: "127.0.0.1", expect: false, label: "loopback no port" },
  { host: "localhost:3000", expect: false, label: "localhost dev" },
  { host: "localhost", expect: false, label: "localhost no port" },
  { host: "127.0.0.42:8080", expect: false, label: "127/8 range" },
  { host: "::1", expect: false, label: "IPv6 loopback" },
  { host: "[::1]:3000", expect: false, label: "IPv6 loopback with port" },
  { host: "masarx.vercel.app", expect: true, label: "production Vercel" },
  { host: "192.168.1.5:3000", expect: true, label: "private LAN (not loopback)" },
  { host: "example.com", expect: true, label: "arbitrary external host" },
  { host: null, expect: true, label: "no host header (defensive)" },
];

let failures = 0;
for (const c of cases) {
  const got = shouldIncludeUpgradeInsecureRequests(c.host);
  const ok = got === c.expect;
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`${tag}  host=${String(c.host).padEnd(28)}  expected=${c.expect}  got=${got}  (${c.label})`);
}

if (failures > 0) {
  console.error(`\n${failures} of ${cases.length} case(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed.`);
