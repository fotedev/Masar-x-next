/**
 * Unit tests for ../ssrf-guard.ts (P0 process-pdf hotfix).
 * Zero dependencies: plain Deno.test + local assert (runs offline).
 * DNS resolution itself needs network and is covered by handler code review
 * plus the live checks listed in the PR (dig + function logs), not here.
 */
import {
  expandIPv6,
  isAllowedDnsAnswer,
  isNonPublicIPv4,
  isNonPublicIPv6,
  parseIPv4,
  resolveRedirectTarget,
  validateFetchUrl,
} from "../ssrf-guard.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

const POLICY = { allowedHosts: ["res.cloudinary.com"] };

Deno.test("legit Cloudinary https URL passes", () => {
  const r = validateFetchUrl("https://res.cloudinary.com/demo/image/upload/v1/docs/a.pdf", POLICY);
  assert(r.ok === true, "legit url must pass");
});

Deno.test("scheme / credentials / port / allowlist rejected", () => {
  assert(validateFetchUrl("http://res.cloudinary.com/a.pdf", POLICY).ok === false, "http");
  assert(
    validateFetchUrl("https://user:pass@res.cloudinary.com/a.pdf", POLICY).ok === false,
    "credentials",
  );
  assert(
    validateFetchUrl("https://res.cloudinary.com:8443/a.pdf", POLICY).ok === false,
    "non-default port",
  );
  assert(validateFetchUrl("https://evil.example.com/a.pdf", POLICY).ok === false, "allowlist");
  assert(
    validateFetchUrl("https://res.cloudinary.com.evil.example.com/a.pdf", POLICY).ok === false,
    "suffix trick",
  );
});

Deno.test("IPv4 literals rejected at URL layer", () => {
  for (
    const h of [
      "https://127.0.0.1/a.pdf",
      "https://10.0.0.5/a.pdf",
      "https://169.254.169.254/latest/meta-data/",
      "https://8.8.8.8/a.pdf", // public but still an IP literal
    ]
  ) {
    const r = validateFetchUrl(h, POLICY);
    assert(r.ok === false, `literal must be rejected: ${h}`);
  }
});

Deno.test("obfuscated IPv4 forms never parse as public", () => {
  assert(parseIPv4("0177.0.0.1") === null, "octal-ish leading zeros rejected");
  assert(parseIPv4("0x7f.0.0.1") === null, "hex rejected");
  assert(parseIPv4("2130706433") === null, "dword rejected");
  const loopback = parseIPv4("127.0.0.1");
  assert(loopback !== null && isNonPublicIPv4(loopback), "127.0.0.1 is non-public");
});

Deno.test("private IPv4 ranges incl. metadata + CGNAT blocked", () => {
  const blocked = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "192.0.2.1",
    "198.51.100.7",
    "203.0.113.9",
  ];
  for (const ip of blocked) {
    const n = parseIPv4(ip);
    assert(n !== null && isNonPublicIPv4(n), `must be blocked: ${ip}`);
  }
  const pub = parseIPv4("93.184.216.34");
  assert(pub !== null && !isNonPublicIPv4(pub), "public address must pass");
  const edge = parseIPv4("172.32.0.1");
  assert(edge !== null && !isNonPublicIPv4(edge), "172.32.0.1 is public (past /12)");
});

Deno.test("IPv6: loopback, ULA, link-local, mapped-v4 blocked", () => {
  for (const ip of ["::1", "::", "fc00::1", "fd00::99", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.1.2.3"]) {
    const g = expandIPv6(ip);
    assert(g !== null && isNonPublicIPv6(g), `must be blocked: ${ip}`);
  }
  const pub = expandIPv6("2606:2800:220:1:248:1893:25c8:1946");
  assert(pub !== null && !isNonPublicIPv6(pub), "public v6 must pass");
  const mappedPub = expandIPv6("::ffff:93.184.216.34");
  assert(mappedPub !== null && !isNonPublicIPv6(mappedPub), "mapped public v4 must pass");
  assert(expandIPv6("fe80::1%eth0") === null, "zone id rejected");
});

Deno.test("DNS answers: private resolution rejected (redirect-to-internal case)", () => {
  assert(!isAllowedDnsAnswer("127.0.0.1"), "dns 127.0.0.1");
  assert(!isAllowedDnsAnswer("169.254.169.254"), "dns metadata ip");
  assert(!isAllowedDnsAnswer("::ffff:169.254.169.254"), "dns mapped metadata");
  assert(!isAllowedDnsAnswer("not-an-ip"), "dns garbage fail-closed");
  assert(isAllowedDnsAnswer("93.184.216.34"), "dns public ok");
});

Deno.test("redirect target resolution + re-validation kills internal hops", () => {
  const current = new URL("https://res.cloudinary.com/a.pdf");
  const toInternal = resolveRedirectTarget("http://169.254.169.254/x", current);
  assert(toInternal !== null, "resolves");
  const v = validateFetchUrl(toInternal!, POLICY);
  assert(v.ok === false, "redirect to internal must fail re-validation");
  const rel = resolveRedirectTarget("/other.pdf", current);
  assert(rel === "https://res.cloudinary.com/other.pdf", "relative redirect");
  assert(resolveRedirectTarget(null, current) === null, "missing location");
});
