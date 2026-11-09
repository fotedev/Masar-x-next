/**
 * Unit tests for ../net.ts (spec 040 Wave 6).
 * Zero dependencies: plain Deno.test + local assert (runs offline, no stubs).
 *
 * Pins the IP-header priority matrix and the spoofing-resistance property
 * (platform-injected headers win over client-supplied x-forwarded-for), plus
 * checkRateLimit's boolean coercion / fail-open contract.
 */
import { checkRateLimit, getClientIp, type RateLimitRpc } from "../net.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    throw new Error(
      `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://functions.local/x", { headers });
}

// ---------------------------------------------------------------------------
// getClientIp — header priority matrix
// ---------------------------------------------------------------------------

Deno.test("getClientIp: cf-connecting-ip used alone", () => {
  assertEquals(
    getClientIp(reqWith({ "cf-connecting-ip": "203.0.113.7" })),
    "203.0.113.7",
    "cf only",
  );
});

Deno.test("getClientIp: spoof resistance — client-supplied XFF never beats CF header", () => {
  assertEquals(
    getClientIp(reqWith({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 7.7.7.7",
      "x-real-ip": "8.8.8.8",
    })),
    "203.0.113.7",
    "CF wins over every client-settable header",
  );
});

Deno.test("getClientIp: sb-forwarded-for beats x-forwarded-for and x-real-ip", () => {
  assertEquals(
    getClientIp(reqWith({
      "sb-forwarded-for": "198.51.100.9",
      "x-forwarded-for": "6.6.6.6",
      "x-real-ip": "8.8.8.8",
    })),
    "198.51.100.9",
    "sb gateway header wins",
  );
});

Deno.test("getClientIp: x-forwarded-for beats x-real-ip", () => {
  assertEquals(
    getClientIp(reqWith({
      "x-forwarded-for": "6.6.6.6",
      "x-real-ip": "8.8.8.8",
    })),
    "6.6.6.6",
    "XFF last-resort but above x-real-ip",
  );
});

Deno.test("getClientIp: x-real-ip used when nothing above it is present", () => {
  assertEquals(
    getClientIp(reqWith({ "x-real-ip": "8.8.8.8" })),
    "8.8.8.8",
    "nginx-style fallback",
  );
});

Deno.test("getClientIp: no IP headers -> 'unknown' sentinel", () => {
  assertEquals(getClientIp(reqWith({})), "unknown", "empty headers");
});

// ---------------------------------------------------------------------------
// getClientIp — XFF first-hop-only extraction
// ---------------------------------------------------------------------------

Deno.test("getClientIp: XFF proxy chain — takes FIRST entry only", () => {
  assertEquals(
    getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.9.9.9" })),
    "1.2.3.4",
    "first hop",
  );
});

Deno.test("getClientIp: XFF first hop is trimmed", () => {
  assertEquals(
    getClientIp(reqWith({ "x-forwarded-for": "  1.2.3.4 ,5.6.7.8" })),
    "1.2.3.4",
    "trimmed first hop",
  );
});

Deno.test("getClientIp: sb-forwarded-for is also first-hop-only", () => {
  assertEquals(
    getClientIp(reqWith({ "sb-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    "1.2.3.4",
    "sb first hop",
  );
});

Deno.test("getClientIp: cf-connecting-ip is used verbatim (no comma split)", () => {
  assertEquals(
    getClientIp(reqWith({ "cf-connecting-ip": " 203.0.113.7 " })),
    "203.0.113.7",
    "trimmed but not split",
  );
});

// ---------------------------------------------------------------------------
// checkRateLimit — boolean coercion + fail-open surface
// ---------------------------------------------------------------------------

interface RpcCall {
  fn: string;
  args: unknown;
}

/** Fake RateLimitRpc returning a scripted `data` (or rejecting). */
function fakeRpc(scripted: unknown, throw_ = false): { client: RateLimitRpc; calls: RpcCall[] } {
  const calls: RpcCall[] = [];
  return {
    calls,
    client: {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args });
        if (throw_) return Promise.reject(new Error("rpc down"));
        return Promise.resolve({ data: scripted });
      },
    },
  };
}

const BASE_OPTS = {
  identifier: "1.2.3.4",
  endpoint: "request-password-reset-ip",
  maxRequests: 10,
  windowMinutes: 60,
};

Deno.test("checkRateLimit: rpc allowed=true -> true", async () => {
  const { client, calls } = fakeRpc(true);
  const result = await checkRateLimit(client, BASE_OPTS);
  assertEquals(result, true, "allowed");
  assertEquals(calls.length, 1, "one rpc call");
  assertEquals(calls[0].fn, "check_rate_limit", "rpc fn name");
  assertEquals(
    JSON.stringify(calls[0].args),
    JSON.stringify({
      p_identifier: "1.2.3.4",
      p_endpoint: "request-password-reset-ip",
      p_max_requests: 10,
      p_window_minutes: 60,
    }),
    "rpc args mapping",
  );
});

Deno.test("checkRateLimit: rpc allowed=false -> false (limit exceeded)", async () => {
  const { client } = fakeRpc(false);
  assertEquals(await checkRateLimit(client, BASE_OPTS), false, "denied");
});

Deno.test("checkRateLimit: non-boolean data (null/undefined/number) -> undefined", async () => {
  assertEquals(await checkRateLimit(fakeRpc(null).client, BASE_OPTS), undefined, "null data");
  assertEquals(
    await checkRateLimit(fakeRpc(undefined).client, BASE_OPTS),
    undefined,
    "undefined data",
  );
  assertEquals(await checkRateLimit(fakeRpc(1).client, BASE_OPTS), undefined, "truthy number");
});

Deno.test("checkRateLimit: rpc rejection propagates (caller keeps fail-open/429 semantics)", async () => {
  const { client } = fakeRpc(undefined, true);
  let rejected = false;
  try {
    await checkRateLimit(client, BASE_OPTS);
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true, "error surfaces to the caller");
});
