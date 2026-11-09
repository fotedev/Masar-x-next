/**
 * Unit tests for ../cors.ts and ../http.ts (spec 040 Wave 6).
 * Fully pure — no stubs, no network, plain Deno.test + local assert.
 *
 * Pins: origin allowlist echo (single-origin ACAO), the full CORS header
 * shape, preflight replies, jsonResponse status/content-type/body, and the
 * shared methodGuard (OPTIONS -> preflight, POST -> null, else 405).
 */
import { buildCorsHeaders, resolveOrigin } from "../cors.ts";
import { corsPreflight, jsonResponse, methodGuard } from "../http.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function reqWith(method: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request("https://functions.local/x", { method, headers: extraHeaders });
}

async function bodyOf(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

// ---------------------------------------------------------------------------
// resolveOrigin — allowlist echo
// ---------------------------------------------------------------------------

Deno.test("resolveOrigin: echoes each allowlisted origin", () => {
  for (const origin of [
    "https://masarx.vercel.app",
    "https://masar-x.vercel.app",
    "https://www.masarx.com",
    "https://localhost:3000",
    "http://localhost:3000",
  ]) {
    assertEquals(resolveOrigin(reqWith("POST", { Origin: origin })), origin, origin);
  }
});

Deno.test("resolveOrigin: disallowed origin -> first production origin fallback", () => {
  assertEquals(
    resolveOrigin(reqWith("POST", { Origin: "https://evil.example.com" })),
    "https://masarx.vercel.app",
    "attacker origin not echoed",
  );
  assertEquals(
    resolveOrigin(reqWith("POST", { Origin: "https://masarx.vercel.app.evil.com" })),
    "https://masarx.vercel.app",
    "suffix-spoofed origin not echoed",
  );
});

Deno.test("resolveOrigin: missing Origin header -> fallback", () => {
  assertEquals(
    resolveOrigin(reqWith("POST")),
    "https://masarx.vercel.app",
    "no Origin header",
  );
});

// ---------------------------------------------------------------------------
// buildCorsHeaders — header shape
// ---------------------------------------------------------------------------

Deno.test("buildCorsHeaders: full header shape, single origin (never a list)", () => {
  const headers = buildCorsHeaders(reqWith("POST", { Origin: "https://www.masarx.com" }));
  assertEquals(headers["Access-Control-Allow-Origin"], "https://www.masarx.com", "echoed origin");
  assertEquals(
    headers["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-api-key",
    "allowed headers",
  );
  assertEquals(
    headers["Access-Control-Allow-Methods"],
    "POST, GET, OPTIONS, PUT, DELETE, PATCH",
    "allowed methods",
  );
  assertEquals(headers["Vary"], "Origin", "cache vary");
  assertEquals(
    (headers["Access-Control-Allow-Origin"] ?? "").includes(","),
    false,
    "exactly ONE origin value",
  );
});

Deno.test("buildCorsHeaders: explicit allowedOrigin overrides the resolver", () => {
  const headers = buildCorsHeaders(
    reqWith("POST", { Origin: "https://evil.example.com" }),
    "https://masar-x.vercel.app",
  );
  assertEquals(headers["Access-Control-Allow-Origin"], "https://masar-x.vercel.app", "forced");
});

// ---------------------------------------------------------------------------
// corsPreflight
// ---------------------------------------------------------------------------

Deno.test("corsPreflight: 200 'ok' with CORS headers", async () => {
  const res = corsPreflight(reqWith("OPTIONS", { Origin: "https://www.masarx.com" }));
  assertEquals(res.status, 200, "status");
  assertEquals(await res.text(), "ok", "body");
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://www.masarx.com",
    "echoed origin",
  );
});

// ---------------------------------------------------------------------------
// jsonResponse
// ---------------------------------------------------------------------------

Deno.test("jsonResponse: default 200, JSON content-type, CORS headers, stringified body", async () => {
  const res = jsonResponse(reqWith("POST", { Origin: "https://masarx.vercel.app" }), {
    success: true,
  });
  assertEquals(res.status, 200, "status");
  assertEquals(res.headers.get("Content-Type"), "application/json", "content-type");
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://masarx.vercel.app",
    "cors origin",
  );
  assertEquals(res.headers.get("Vary"), "Origin", "vary");
  assertEquals(await bodyOf(res), { success: true }, "parsed body");
});

Deno.test("jsonResponse: custom status and extra headers merged last", async () => {
  const res = jsonResponse(
    reqWith("GET"),
    { error: "Method not allowed" },
    405,
    { Allow: "POST, OPTIONS" },
  );
  assertEquals(res.status, 405, "status");
  assertEquals(res.headers.get("Allow"), "POST, OPTIONS", "extra header");
  assertEquals(await bodyOf(res), { error: "Method not allowed" }, "body");
});

// ---------------------------------------------------------------------------
// methodGuard
// ---------------------------------------------------------------------------

Deno.test("methodGuard: OPTIONS -> preflight response", async () => {
  const res = methodGuard(reqWith("OPTIONS"));
  assertEquals(res === null, false, "returns a response");
  const preflight = res as Response;
  assertEquals(preflight.status, 200, "preflight status");
  assertEquals(await preflight.text(), "ok", "preflight body");
});

Deno.test("methodGuard: POST -> null (continue handling)", () => {
  assertEquals(methodGuard(reqWith("POST")), null, "null for POST");
});

Deno.test("methodGuard: other methods -> 405 with Allow passthrough", async () => {
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const res = methodGuard(reqWith(method), { Allow: "POST, OPTIONS" }) as Response;
    assertEquals(res.status, 405, `${method} status`);
    assertEquals(res.headers.get("Allow"), "POST, OPTIONS", `${method} Allow header`);
    assertEquals(
      await bodyOf(res),
      { error: "Method not allowed" },
      `${method} body`,
    );
  }
});

Deno.test("methodGuard: 405 without extra headers still has CORS + JSON shape", async () => {
  const res = methodGuard(reqWith("GET")) as Response;
  assertEquals(res.headers.get("Content-Type"), "application/json", "content-type");
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://masarx.vercel.app",
    "fallback origin",
  );
});
