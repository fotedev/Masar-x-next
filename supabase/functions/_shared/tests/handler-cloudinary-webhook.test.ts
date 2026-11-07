/**
 * Handler-level tests for ../../cloudinary-webhook/index.ts (spec 040 Wave 6).
 * Run: deno test --allow-env --import-map=supabase/functions/_shared/tests/import-map.json
 *        supabase/functions/_shared/tests/handler-cloudinary-webhook.test.ts
 * The real handler is pulled out of the captured serve() callback (std-server
 * stub); supabase-js is the scenario stub, and signatures are computed with
 * the same keyed-digest construction the real verifier expects (the real
 * signature module runs unstubbed — see ./signature_test.ts for its own suite).
 * No network.
 */

Deno.env.set("SUPABASE_URL", "https://test-project.supabase.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-fake-service-key");
Deno.env.set("CLOUDINARY_API_SECRET", "test-fake-cld-secret");

await import("../../cloudinary-webhook/index.ts");
const g = globalThis as unknown as {
  __SERVED_HANDLERS__?: Array<(req: Request) => Promise<Response>>;
};
const handlers = g.__SERVED_HANDLERS__ ?? [];
if (handlers.length === 0) throw new Error("serve() handler was not captured");
const handleWebhook = handlers[handlers.length - 1]!;

const API_SECRET = "test-fake-cld-secret";
const TIMESTAMP = String(Math.floor(Date.now() / 1000));

interface Scenario {
  users: Record<string, { id: string } | null>;
  profileRow: { avatar_url: string | null } | null;
  rpcAllowed?: boolean;
  rpcEndpointAllowed?: Record<string, boolean>;
  admins?: Array<{ user_id: string }>;
  summaryRow?: { id: string };
  insertError?: boolean;
  calls: { updates: Array<unknown>; inserts: Array<{ table: string; values: unknown }> };
}

function baseScenario(): Scenario {
  return {
    users: {},
    profileRow: null,
    admins: [],
    calls: { updates: [], inserts: [] },
  };
}

function setScenario(s: Scenario): void {
  (globalThis as unknown as Record<string, unknown>).__SCENARIO__ = s;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

/** Compute the keyed digest Cloudinary sends (body + timestamp + secret). */
async function sign(body: string, timestamp = TIMESTAMP, secret = API_SECRET): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${body}${timestamp}${secret}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signedReq(
  body: string,
  opts: { timestamp?: string | null; signature?: string | null } = {},
): Promise<Request> {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.timestamp !== null) headers.set("x-cld-timestamp", opts.timestamp ?? TIMESTAMP);
  if (opts.signature !== null) headers.set("x-cld-signature", opts.signature ?? await sign(body));
  return new Request("https://functions.local/cloudinary-webhook", {
    method: "POST",
    headers,
    body,
  });
}

function insertsFor(s: Scenario, table: string): Array<{ table: string; values: unknown }> {
  return s.calls.inserts.filter((i) => i.table === table);
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Guard rails
// ---------------------------------------------------------------------------

Deno.test("handler: OPTIONS -> preflight 200", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(new Request("https://functions.local/x", { method: "OPTIONS" }));
  assert(res.status === 200 && (await res.text()) === "ok", "preflight");
});

Deno.test("handler: GET -> 405 with Allow header", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(new Request("https://functions.local/x", { method: "GET" }));
  assert(res.status === 405, `status ${res.status}`);
  assert(res.headers.get("Allow") === "POST, OPTIONS", "Allow header");
});

Deno.test("handler: missing signature headers -> 401", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(await signedReq("{}", { signature: null }));
  assert(res.status === 401, `status ${res.status}`);
  assert((await bodyOf(res)).error === "Unauthorized", "error body");
});

Deno.test("handler: wrong signature (valid hex, wrong digest) -> 401", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(
    await signedReq("{}", { signature: "a".repeat(40) }),
  );
  assert(res.status === 401, `status ${res.status}`);
});

Deno.test("handler: signature checked BEFORE rate limit and payload parse (throttled + bad sig -> 401)", async () => {
  const s = baseScenario();
  s.rpcEndpointAllowed = { "cloudinary-webhook": false };
  setScenario(s);
  const res = await handleWebhook(await signedReq("{}", { signature: "b".repeat(40) }));
  assert(res.status === 401, `expected 401 first, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Payload-shape guard (after a VALID signature)
// ---------------------------------------------------------------------------

Deno.test("handler: valid signature + non-object payload (array) -> 400", async () => {
  setScenario(baseScenario());
  const body = "[1,2,3]";
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 400, `status ${res.status}`);
  assert((await bodyOf(res)).error === "Invalid JSON payload", "error body");
});

Deno.test("handler: valid signature + null payload -> 400", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(await signedReq("null"));
  assert(res.status === 400, `status ${res.status}`);
});

Deno.test("handler: valid signature + invalid JSON -> 400", async () => {
  setScenario(baseScenario());
  const res = await handleWebhook(await signedReq("not-json{"));
  assert(res.status === 400, `status ${res.status}`);
});

Deno.test("handler: rate-limited (valid signature) -> 429", async () => {
  const s = baseScenario();
  s.rpcEndpointAllowed = { "cloudinary-webhook": false };
  setScenario(s);
  const res = await handleWebhook(await signedReq("{}"));
  assert(res.status === 429, `status ${res.status}`);
  assert((await bodyOf(res)).error === "Too many requests", "error body");
  assert(insertsFor(s, "summaries").length === 0, "no insert when throttled");
});

// ---------------------------------------------------------------------------
// Upload mapping: tags -> subject/year/department, summaries insert
// ---------------------------------------------------------------------------

Deno.test("handler: upload notification maps tags[0..2] and inserts the summaries row", async () => {
  const s = baseScenario();
  s.admins = [];
  s.summaryRow = { id: "summary-42" };
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/math_final",
    url: "https://res.cloudinary.com/demo/image/upload/v1/masarx/math_final.pdf",
    tags: ["رياضيات", "2024", "علوم حاسب"],
    context: { custom: { contributor: "أحمد" } },
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  const parsed = await bodyOf(res);
  assert(parsed.success === true && parsed.summary_id === "summary-42", "response body");

  const rows = insertsFor(s, "summaries");
  assert(rows.length === 1, "one summaries insert");
  const row = rows[0].values as Record<string, unknown>;
  assert(row.title === "masarx/math_final", "title = public_id");
  assert(
    row.pdf_url === "https://res.cloudinary.com/demo/image/upload/v1/masarx/math_final.pdf",
    "pdf_url = url",
  );
  assert(row.status === "pending", "status pending");
  assert(row.subject === "رياضيات", "subject = tags[0]");
  assert(row.year === "2024", "year = tags[1]");
  assert(row.department === "علوم حاسب", "department = tags[2]");
  assert(
    typeof row.content === "string" && (row.content as string).includes("masarx/math_final"),
    "content mentions public_id",
  );
  assert(row.contributor_name === "أحمد", "contributor from context.custom");
});

Deno.test("handler: missing tags fall back to Arabic defaults", async () => {
  const s = baseScenario();
  s.admins = [];
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/file2",
    url: "https://res.cloudinary.com/demo/x.pdf",
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  const row = insertsFor(s, "summaries")[0].values as Record<string, unknown>;
  assert(row.subject === "غير محدد", "subject default");
  assert(row.year === "غير محدد", "year default");
  assert(row.department === "ذكاء اصطناعي", "department default");
  assert(row.contributor_name === null, "contributor null when absent");
});

Deno.test("handler: partial tags -> only mapped slots filled, rest default", async () => {
  const s = baseScenario();
  s.admins = [];
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/file3",
    url: "https://res.cloudinary.com/demo/y.pdf",
    tags: ["فيزياء"],
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  const row = insertsFor(s, "summaries")[0].values as Record<string, unknown>;
  assert(row.subject === "فيزياء", "subject from single tag");
  assert(row.year === "غير محدد", "year default");
  assert(row.department === "ذكاء اصطناعي", "department default");
});

Deno.test("handler: missing public_id -> title falls back to 'ملف جديد'", async () => {
  const s = baseScenario();
  s.admins = [];
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    url: "https://res.cloudinary.com/demo/z.pdf",
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  const row = insertsFor(s, "summaries")[0].values as Record<string, unknown>;
  assert(row.title === "ملف جديد", "title default");
});

// ---------------------------------------------------------------------------
// Admin notification fan-out
// ---------------------------------------------------------------------------

Deno.test("handler: admins get one notification each with the summary reference", async () => {
  const s = baseScenario();
  s.admins = [{ user_id: "admin-1" }, { user_id: "admin-2" }];
  s.summaryRow = { id: "summary-77" };
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/notify-me",
    url: "https://res.cloudinary.com/demo/n.pdf",
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);

  const rows = insertsFor(s, "notifications");
  assert(rows.length === 1, "one bulk notifications insert");
  const notifications = rows[0].values as Array<Record<string, unknown>>;
  assert(Array.isArray(notifications) && notifications.length === 2, "two notifications");
  for (const [index, notification] of notifications.entries()) {
    assert(notification.user_id === `admin-${index + 1}`, `user_id ${index}`);
    assert(notification.related_id === "summary-77", "related_id = summary id");
    assert(notification.related_type === "summary", "related_type");
    assert(notification.type === "admin_submission", "type");
    assert(notification.read === false, "unread");
    assert(
      typeof notification.message === "string" &&
        (notification.message as string).includes("masarx/notify-me"),
      "message mentions public_id",
    );
  }
});

Deno.test("handler: no admins -> no notifications insert, still 200", async () => {
  const s = baseScenario();
  s.admins = [];
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/solo",
    url: "https://res.cloudinary.com/demo/s.pdf",
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  assert(insertsFor(s, "notifications").length === 0, "no notifications insert");
});

// ---------------------------------------------------------------------------
// Non-upload notifications
// ---------------------------------------------------------------------------

Deno.test("handler: non-upload notification_type -> 200 ack, no inserts", async () => {
  const s = baseScenario();
  setScenario(s);
  const body = JSON.stringify({ notification_type: "delete", public_id: "masarx/gone" });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 200, `status ${res.status}`);
  const parsed = await bodyOf(res);
  assert(parsed.message === "Webhook processed successfully", "ack body");
  assert(insertsFor(s, "summaries").length === 0, "no summaries insert");
  assert(insertsFor(s, "notifications").length === 0, "no notifications insert");
});

Deno.test("handler: summaries insert failure -> 500 generic error (non-Error throw is masked)", async () => {
  const s = baseScenario();
  s.admins = [];
  s.insertError = true;
  setScenario(s);
  const body = JSON.stringify({
    notification_type: "upload",
    public_id: "masarx/boom",
    url: "https://res.cloudinary.com/demo/b.pdf",
  });
  const res = await handleWebhook(await signedReq(body));
  assert(res.status === 500, `status ${res.status}`);
  const parsed = await bodyOf(res);
  // The stub error is a plain object (not an Error), so the catch masks it
  // to 'Unknown error' — pin that exact behavior.
  assert(parsed.error === "Unknown error", `error body: ${JSON.stringify(parsed)}`);
});
