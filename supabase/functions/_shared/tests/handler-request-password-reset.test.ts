/**
 * Handler-level tests for ../../request-password-reset/index.ts (spec 040
 * Wave 6). Run: deno test --allow-env --import-map=supabase/functions/_shared/tests/import-map.json
 *        supabase/functions/_shared/tests/handler-request-password-reset.test.ts
 * The real handler is pulled out of the captured serve() callback
 * (std-server stub) with a stubbed supabase-js client, a stubbed raw-REST
 * fetch (token insert) and a stubbed Brevo fetch. No network.
 *
 * KEY invariant under test: enumeration safety — throttled, not-found and
 * found accounts all return the SAME body/status.
 */

// Env must exist BEFORE the handler module evaluates (it snapshots
// BREVO_API_KEY into a module-level const at import time).
Deno.env.set("BREVO_API_KEY", "test-fake-brevo-key");
Deno.env.set("SUPABASE_URL", "https://test-project.supabase.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-fake-service-key");

// Pull the real serve() callback out of index.ts (loaded through the stubs).
await import("../../request-password-reset/index.ts");
const g = globalThis as unknown as {
  __SERVED_HANDLERS__?: Array<(req: Request) => Promise<Response>>;
};
const handlers = g.__SERVED_HANDLERS__ ?? [];
if (handlers.length === 0) throw new Error("serve() handler was not captured");
const handleRequestPasswordReset = handlers[handlers.length - 1]!;

// EdgeRuntime.waitUntil stub — captures background work so tests can await
// it deterministically (production uses the same hook to keep the isolate
// alive; the handler awaits inline only when waitUntil is absent).
const pendingBackground: Array<Promise<unknown>> = [];
(globalThis as unknown as Record<string, unknown>).EdgeRuntime = {
  waitUntil: (p: Promise<unknown>) => {
    pendingBackground.push(p);
  },
};

const UNIFORM_BODY = JSON.stringify({
  success: true,
  message: "إذا كان البريد الإلكتروني مسجل في النظام، ستتلقى رسالة إعادة التعيين",
});

const USER_ID = "cccccccc-1111-2222-3333-444444444444";
const REST_URL = "https://test-project.supabase.local/rest/v1/password_reset_tokens";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

interface Scenario {
  users: Record<string, { id: string } | null>;
  profileRow: { avatar_url: string | null } | null;
  rpcAllowed?: boolean;
  rpcEndpointAllowed?: Record<string, boolean>;
  rpcError?: boolean;
  usersByEmail?: Record<string, { id: string } | null>;
  getUserByEmailError?: boolean;
  calls: { updates: Array<unknown>; inserts: Array<unknown> };
}

interface RestInsert {
  url: string;
  method: string;
  headers: Record<string, string>;
  tokenData: Record<string, unknown>;
}

interface BrevoCall {
  email: string | undefined;
  resetToken: string | null;
}

interface FetchScript {
  /** what the REST token-insert returns */
  insertStatus: number;
  insertText: string;
}

function baseScenario(): Scenario {
  return {
    users: {},
    profileRow: null,
    calls: { updates: [], inserts: [] },
  };
}

let restInserts: RestInsert[] = [];
let brevoCalls: BrevoCall[] = [];

function stubFetch(script: FetchScript): void {
  restInserts = [];
  brevoCalls = [];
  (globalThis as unknown as Record<string, unknown>).fetch = (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => {
    if (String(url).startsWith(REST_URL)) {
      let tokenData: Record<string, unknown> = {};
      try {
        tokenData = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
      } catch {
        tokenData = {};
      }
      restInserts.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers: init?.headers ?? {},
        tokenData,
      });
      return Promise.resolve({
        ok: script.insertStatus < 400,
        status: script.insertStatus,
        text: () => Promise.resolve(script.insertText),
      } as unknown as Response);
    }
    if (String(url).startsWith(BREVO_URL)) {
      const html = String((JSON.parse(init?.body ?? "{}") as { htmlContent?: string }).htmlContent ?? "");
      const token = html.match(/reset-password\?token=([A-Za-z0-9_-]+)/)?.[1] ?? null;
      brevoCalls.push({
        email: (JSON.parse(init?.body ?? "{}") as { to?: Array<{ email?: string }> }).to?.[0]?.email,
        resetToken: token,
      });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
    }
    return Promise.reject(new Error(`unexpected fetch in test: ${String(url)}`));
  };
}

function req(method: string, body?: unknown): Request {
  const headers = new Headers({ "content-type": "application/json" });
  return new Request("https://functions.local/request-password-reset", {
    method,
    headers,
    body: body === undefined ? null : JSON.stringify(body),
  });
}

async function settleBackground(): Promise<void> {
  const pending = pendingBackground.splice(0);
  await Promise.all(pending);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function setScenario(s: Scenario): void {
  (globalThis as unknown as Record<string, unknown>).__SCENARIO__ = s;
}

// ---------------------------------------------------------------------------
// The enumeration-safety invariant
// ---------------------------------------------------------------------------

Deno.test("handler: uniform response — throttled / not-found / found ALL identical (enumeration safety)", async () => {
  const variants: Array<[string, Scenario]> = [
    ["IP throttled", {
      ...baseScenario(),
      usersByEmail: { "known@example.com": { id: USER_ID } },
      rpcEndpointAllowed: { "request-password-reset-ip": false },
    }],
    ["not found", {
      ...baseScenario(),
      usersByEmail: { "known@example.com": null },
      rpcAllowed: true,
    }],
    ["found + full success", {
      ...baseScenario(),
      usersByEmail: { "known@example.com": { id: USER_ID } },
      rpcAllowed: true,
    }],
  ];
  const bodies: string[] = [];
  for (const [label, scenario] of variants) {
    setScenario(scenario);
    stubFetch({ insertStatus: 201, insertText: "[]" });
    const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
    await settleBackground();
    const text = await res.text();
    assert(res.status === 200, `${label}: status ${res.status}`);
    assert(text === UNIFORM_BODY, `${label}: body differs from uniform: ${text}`);
    assert(
      res.headers.get("Content-Type") === "application/json",
      `${label}: content-type`,
    );
    bodies.push(text);
  }
  assert(
    bodies.every((b) => b === bodies[0]),
    "all three variants byte-identical",
  );
});

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

Deno.test("handler: IP rate limit exceeded -> uniform 200, no lookup side effects, no email", async () => {
  const s = baseScenario();
  s.rpcEndpointAllowed = { "request-password-reset-ip": false };
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 0, "no token insert");
  assert(brevoCalls.length === 0, "no Brevo call");
});

Deno.test("handler: IP rpc hard error -> fail-open, request continues", async () => {
  const s = baseScenario();
  s.rpcError = true; // both IP and email rpc calls reject
  s.usersByEmail = { "known@example.com": { id: USER_ID } };
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 1, "fail-open: token insert still ran");
  assert(brevoCalls.length === 1, "fail-open: email still sent");
});

Deno.test("handler: email rate limit exceeded -> uniform 200, background work silently skipped", async () => {
  const s = baseScenario();
  s.rpcEndpointAllowed = {
    "request-password-reset-ip": true,
    "request-password-reset": false,
  };
  s.usersByEmail = { "known@example.com": { id: USER_ID } };
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 0, "no token insert after email throttle");
  assert(brevoCalls.length === 0, "no email after throttle");
});

// ---------------------------------------------------------------------------
// Lookup outcomes
// ---------------------------------------------------------------------------

Deno.test("handler: unknown email -> uniform 200, nothing persisted, no email", async () => {
  const s = baseScenario();
  s.usersByEmail = { "ghost@example.com": null };
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "ghost@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 0, "no token insert");
  assert(brevoCalls.length === 0, "no Brevo call");
});

Deno.test("handler: getUserByEmail hard error -> uniform 200, nothing persisted", async () => {
  const s = baseScenario();
  s.getUserByEmailError = true;
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 0, "no token insert");
  assert(brevoCalls.length === 0, "no Brevo call");
});

// ---------------------------------------------------------------------------
// Hashed-token persistence (SECURITY F5)
// ---------------------------------------------------------------------------

Deno.test("handler: happy path — only the sha256 HASH is stored, raw token only in the email link", async () => {
  const s = baseScenario();
  s.usersByEmail = { "known@example.com": { id: USER_ID } };
  s.rpcAllowed = true;
  setScenario(s);
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();

  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200");
  assert(restInserts.length === 1, "exactly one REST insert");
  const insert = restInserts[0];
  assert(insert.url === REST_URL, `insert url ${insert.url}`);
  assert(insert.method === "POST", "insert method");
  assert(insert.headers["apikey"] === "test-fake-service-key", "service key header");
  assert(
    insert.headers["Authorization"] === "Bearer test-fake-service-key",
    "bearer service key",
  );
  assert(insert.headers["Prefer"] === "return=representation", "prefer header");
  assert(insert.tokenData.user_id === USER_ID, "user_id");
  assert(insert.tokenData.email === "known@example.com", "email");
  assert(typeof insert.tokenData.expires_at === "string", "expires_at ISO string");

  // The stored value is a sha256 hex of the token from the email link —
  // never the raw token itself.
  const storedHash = String(insert.tokenData.token_hash ?? "");
  assert(/^[0-9a-f]{64}$/.test(storedHash), `stored hash is 64-char lowercase hex: ${storedHash}`);
  assert(brevoCalls.length === 1, "exactly one Brevo send");
  const rawToken = brevoCalls[0].resetToken ?? "";
  assert(rawToken.length === 32, `raw token is 32 chars: ${rawToken}`);
  assert(brevoCalls[0].email === "known@example.com", "email recipient");
  assert(storedHash !== rawToken, "raw token NOT stored");
  assert(!storedHash.includes(rawToken), "raw token not embedded in stored value");
  const expectedHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  const expectedHex = Array.from(new Uint8Array(expectedHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  assert(storedHash === expectedHex, "stored hash == sha256(raw token)");
});

Deno.test("handler: REST insert failure -> NO email sent, response stays uniform 200", async () => {
  const s = baseScenario();
  s.usersByEmail = { "known@example.com": { id: USER_ID } };
  s.rpcAllowed = true;
  setScenario(s);
  stubFetch({ insertStatus: 500, insertText: '{"message":"db down"}' });
  const res = await handleRequestPasswordReset(req("POST", { email: "known@example.com" }));
  await settleBackground();
  assert(res.status === 200 && (await res.text()) === UNIFORM_BODY, "uniform 200 despite infra failure");
  assert(restInserts.length === 1, "insert attempted");
  assert(brevoCalls.length === 0, "CRITICAL: no email when insert failed");
});

// ---------------------------------------------------------------------------
// Guard rails
// ---------------------------------------------------------------------------

Deno.test("handler: missing email -> 400, no side effects", async () => {
  setScenario(baseScenario());
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const res = await handleRequestPasswordReset(req("POST", {}));
  const body = await res.json() as { error?: string };
  assert(res.status === 400, `status ${res.status}`);
  assert(body.error === "Email is required", "error body");
  assert(restInserts.length === 0 && brevoCalls.length === 0, "no side effects");
});

Deno.test("handler: OPTIONS -> preflight 200, GET -> 405", async () => {
  setScenario(baseScenario());
  stubFetch({ insertStatus: 201, insertText: "[]" });
  const pre = await handleRequestPasswordReset(req("OPTIONS"));
  assert(pre.status === 200 && (await pre.text()) === "ok", "preflight");
  const wrong = await handleRequestPasswordReset(req("GET"));
  assert(wrong.status === 405, `GET status ${wrong.status}`);
});
