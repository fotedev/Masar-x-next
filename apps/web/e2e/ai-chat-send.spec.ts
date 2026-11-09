import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * AI assistant send → /api/ai/chat fallback ladder (specs 008/011/040).
 *
 * The primary chat path is the bundled Puter SDK. To make the run hit the
 * SERVER-side fallback (POST /api/ai/chat — the code path an e2e test can
 * deterministically mock), the Puter transport must fail with a
 * TRANSPORT-CLASSIFIED error (assistant.ts's isPuterTransportError keyword
 * list) after `puter.ai.chat` is reached. Getting there needs three
 * workarounds, each pinning a real SDK behavior:
 *
 * 1. globalThis.PUTER_API_ORIGIN → https://transport.puter.com (the app's
 *    CSP connect-src allows https://*.puter.com). The SDK refuses tokens
 *    bound to a mismatched origin (it clears them at init and then blocks
 *    the chat call on its interactive authenticateWithPuter popup, which
 *    never resolves headless), so the seeded localStorage token
 *    (puter.auth.token.v2 + .origin.v2) is bound to the SAME origin.
 * 2. Even seeded, the SDK's init can still drop the token, so after the
 *    SDK lazy-loads (first send) the test assigns window.puter.authToken
 *    directly — authenticateWithPuter() short-circuits when authToken is
 *    set, letting the chat call proceed to its /drivers/call XHR.
 * 3. That XHR is route-ABORTED. The SDK rejects with
 *    TypeError("Network request to https://transport.puter.com/drivers/call
 *    failed") — the HOST NAME carries the "transport" keyword, so the app
 *    classifies the failure as a transport error and calls
 *    tryServerSideFallback → POST /api/ai/chat.
 *
 * The SDK's auxiliary endpoints (/whoami, /rao, model catalogue) are
 * fulfilled with 200s so its init barrier clears, and its socket.io
 * handshake is emulated via routeWebSocket (a dead socket otherwise leaves
 * the events service retrying forever).
 *
 * KISS response shape (spec 040): /api/ai/chat answers with the complete
 * plain-text body (the real route streams via toTextStreamResponse, and
 * consumeTextStream reads a plain body identically — no ReadableStream
 * needed in route.fulfill). The bubble must finalize with the full content.
 *
 * ai_chat_messages persistence is NOT asserted: it is a fire-and-forget
 * insert against the (route-mocked) REST layer in this run, and in
 * production it targets the real DB — outside this spec's contract.
 */

const USER_ID = "00000000-0000-4000-8000-00000000e2e3";
const DEPARTMENT_ID = "00000000-0000-4000-8000-00000000d3p7";
const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;

const USER_PROMPT = "What is a closure in JavaScript?";
// Plain, non-greeting, code-free reply so sanitizeAssistantReply (which
// strips opening greetings and wraps unstyled code) passes it through
// unchanged and the assertion can match verbatim.
const AI_REPLY =
  "A closure is a function that remembers the lexical scope it was declared in, so it can still access those variables after the outer function has returned.";
// Distinctive slice of the canned cs_assistant transport-failure message —
// the EN locale text (this spec drives /en; the ar sibling string is
// "خدمة الذكاء الاصطناعي غير متاحة حالياً").
const AI_SERVICE_UNAVAILABLE =
  "The AI service is currently unavailable due to connection issues";

const PUTER_API_ORIGIN = "https://transport.puter.com";
// Direct window.puter.authToken injection value (see sendMessageAndArmPuter).
const FORCED_PUTER_TOKEN = "e2e-forced-puter-token";

function resolveSupabaseRef(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) {
    for (const file of [".env.local", ".env.development", ".env"]) {
      try {
        const raw = readFileSync(path.resolve(process.cwd(), file), "utf8");
        url = raw.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
        if (url) break;
      } catch {
        // file missing — try the next candidate
      }
    }
  }
  if (!url) {
    throw new Error(
      "ai-chat-send.spec: NEXT_PUBLIC_SUPABASE_URL not found (env or apps/web/.env.local) — cannot derive the supabase-js localStorage key",
    );
  }
  return new URL(url).hostname.split(".")[0];
}

function buildSeededSession() {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 30;
  const expiresAt = nowSec + expiresIn;
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const accessToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: USER_ID,
    exp: expiresAt,
    aud: "authenticated",
    role: "authenticated",
  })}.mock-signature`;
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "e2e-user@example.com",
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "E2E User" },
      identities: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

async function seedAuthedSession(page: Page, baseURL?: string) {
  const storageKey = `sb-${resolveSupabaseRef()}-auth-token`;
  const session = buildSeededSession();
  await page.route("**/auth/v1/token?*", (route) => route.fulfill({ json: session }));
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: session.user }));
  await page.route("**/api/auth/sync", (route) => route.fulfill({ json: { ok: true } }));
  await page.context().addCookies([
    {
      name: storageKey,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: new URL(baseURL ?? "http://localhost:3000").hostname,
      path: "/",
    },
  ]);
  // cs_assistant is the mode whose fallback ladder reaches /api/ai/chat.
  // Pin a NON-claude model: the default (zane_ai_selected_model absent →
  // claude-sonnet-4-6) makes executeWithPuter assert Puter sign-in and
  // surface the needs-login canned message — a dead end that never calls
  // /api/ai/chat. The puter.js seeds (PUTER_API_ORIGIN override + token
  // pair) are explained in the file header.
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const puterToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    t: "session",
    sub: "e2e-puter-user",
  })}.e2e-signature`;
  await page.addInitScript(
    ({ token, origin }) => {
      window.localStorage.setItem("zane_ai_last_mode", "cs_assistant");
      window.localStorage.setItem("zane_ai_selected_model", "gpt-5-nano");
      (window as unknown as { PUTER_API_ORIGIN: string }).PUTER_API_ORIGIN = origin;
      window.localStorage.setItem("puter.auth.token.v2", token);
      window.localStorage.setItem("puter.auth.token.origin.v2", origin);
    },
    { token: puterToken, origin: PUTER_API_ORIGIN },
  );
}

async function mockAssistantPageRoutes(page: Page) {
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({
      json: { id: USER_ID, level: 3, semester: 1, department_id: DEPARTMENT_ID },
    }),
  );
  // Empty history page — the send flow appends client-side bubbles.
  await page.route("**/rest/v1/ai_chat_messages*", (route) =>
    route.fulfill({ json: [] }),
  );

  // Puter: auxiliary endpoints answer 200 so the SDK's init/whoami/rao and
  // model-catalogue steps clear; ONLY the /drivers/call chat endpoint is
  // aborted (see the file header for why that yields a transport-classified
  // failure). Other puter hosts are aborted wholesale.
  await page.route("**://transport.puter.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/drivers/call")) return route.abort("failed");
    if (url.includes("/whoami")) {
      return route.fulfill({
        json: {
          username: "e2e-puter-user",
          uuid: "00000000-0000-4000-8000-0000000000p1",
          is_user: true,
        },
      });
    }
    if (url.includes("/puterai/chat/models")) {
      return route.fulfill({ json: { models: [] } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route("**://api.puter.com/**", (route) => route.abort("failed"));
  await page.route("**://puter.com/**", (route) => route.abort("failed"));

  // The SDK's socket.io events connection: emulate the minimal engine.io
  // OPEN + socket.io namespace handshake so the client reaches the
  // connected state immediately instead of retrying a dead host forever.
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    ws.send(
      '0{"sid":"e2e-mock","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
    );
    ws.onMessage((data) => {
      const msg = typeof data === "string" ? data : String(data ?? "");
      if (msg.startsWith("2")) ws.send("3"); // engine.io PING → PONG
      else if (msg.startsWith("40")) ws.send('40{"sid":"e2e-mock"}'); // ns connect ack
    });
  });
}

/**
 * Send one message and force the Puter SDK's authToken as soon as the SDK
 * lazy-loads (the first chat call triggers the import). With authToken set,
 * the SDK's authenticateWithPuter() short-circuits — without this, the chat
 * call blocks on its interactive popup until the app's 30s withTimeout.
 */
async function sendMessageAndArmPuter(page: Page, prompt: string, puterToken: string) {
  await page.getByTestId("chat-input-textarea").fill(prompt);
  await page.getByTestId("chat-send-button").click();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => Boolean((window as unknown as { puter?: unknown }).puter),
        ),
      { timeout: 20_000, message: "puter SDK should lazy-load on first send" },
    )
    .toBe(true);
  await page.evaluate((token) => {
    (window as unknown as { puter: { authToken: string } }).puter.authToken = token;
  }, puterToken);
}

test.describe("AI assistant send (authed, seeded cookie)", () => {
  test("server fallback answers and the assistant bubble finalizes with the full reply", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const chatApiRequests: string[] = [];
    await mockAssistantPageRoutes(page);
    await page.route("**/api/ai/chat", (route) => {
      chatApiRequests.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: AI_REPLY,
      });
    });

    await seedAuthedSession(page, baseURL);
    await page.goto("/en/ai-assistant");

    await expect(page.getByTestId("chat-input-textarea")).toBeVisible();
    await sendMessageAndArmPuter(page, USER_PROMPT, FORCED_PUTER_TOKEN);

    // User bubble renders immediately; the assistant bubble lands after the
    // transport-error retry ladder hands off to the mocked server fallback.
    await expect(page.getByText(USER_PROMPT).first()).toBeVisible();
    await expect(page.getByText(/remembers the lexical scope/).first()).toBeVisible({
      timeout: 60_000,
    });
    expect(chatApiRequests.length).toBeGreaterThanOrEqual(1);
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });

  test("fallback 500 surfaces the localized service-unavailable message", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const chatApiRequests: string[] = [];
    await mockAssistantPageRoutes(page);
    await page.route("**/api/ai/chat", (route) => {
      chatApiRequests.push(route.request().url());
      return route.fulfill({ status: 500, body: "mocked fallback outage" });
    });

    await seedAuthedSession(page, baseURL);
    await page.goto("/en/ai-assistant");

    await expect(page.getByTestId("chat-input-textarea")).toBeVisible();
    await sendMessageAndArmPuter(page, USER_PROMPT, FORCED_PUTER_TOKEN);

    await expect(page.getByText(USER_PROMPT).first()).toBeVisible();
    await expect(page.getByText(AI_SERVICE_UNAVAILABLE).first()).toBeVisible({
      timeout: 60_000,
    });
    expect(chatApiRequests.length).toBeGreaterThanOrEqual(1);
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });
});
