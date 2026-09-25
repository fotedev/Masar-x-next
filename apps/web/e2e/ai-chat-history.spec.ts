import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * AI assistant chat history (specs 008/011) — open at the latest message +
 * scroll-up lazy fetch from ai_chat_messages.
 *
 * Route-mocked like guest-quiz.spec.ts, but the Supabase session itself is
 * seeded in localStorage: supabase-js v2's getSession() reads storage without
 * network, so no /auth/v1 call is needed to appear logged in. The storage key
 * is the default `sb-<ref>-auth-token`, with <ref> derived from the Supabase
 * URL the dev server bundle uses (env var, else parsed from .env.local).
 *
 * ai_chat_messages serves 60 fabricated rows (newest first):
 *   - offset=0&limit=30  → the initial newest page (spec 011 open contract)
 *   - offset=30&limit=30 → the first older page, fetched only when the top
 *                          sentinel enters the viewport on scroll-up
 *   - offset>=60         → [] (ends the pagination)
 * Every other rest/v1 read (profiles, subjects, quizzes, ...) returns [].
 *
 * The fix under test (useChatScroll): the one-shot stick-to-bottom measures
 * LazyMarkdown's 1.5em placeholder heights on open — the real markdown heights
 * mount a beat later with no `messages` change. The content ResizeObserver
 * must re-pin the view, so the page opens at the latest message with no
 * manual scrolling (pre-fix the view stays stranded high in the list even
 * after the chunk loads).
 */

const USER_ID = "00000000-0000-4000-8000-00000000e2e0";
const DEPARTMENT_ID = "00000000-0000-4000-8000-00000000d3p7";
const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const LONG_ANSWER = "إجابة المساعد الطويلة والمفصلة بتنسيق ماركداون واضح. ";

// Newest first (index 0 = newest created_at) — matches the hook's
// `created_at desc` query. Labels count DOWN so MSG-59 is the newest message
// and MSG-0 the oldest: the initial page renders MSG-30..MSG-59 and the
// scroll-up fetch adds MSG-0..MSG-29.
const ROWS = Array.from({ length: 60 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  user_id: USER_ID,
  role: i % 2 === 0 ? "user" : "assistant",
  content:
    i % 2 === 0
      ? `MSG-${59 - i} سؤال المستخدم رقم ${59 - i}`
      : `MSG-${59 - i} ${LONG_ANSWER.repeat(25)}`,
  mode: "cs_assistant",
  created_at: new Date(Date.UTC(2026, 8, 1) + (60 - i) * 60_000).toISOString(),
}));

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
      "ai-chat-history.spec: NEXT_PUBLIC_SUPABASE_URL not found (env or apps/web/.env.local) — cannot derive the supabase-js localStorage key",
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
  // The web runtime builds its client through @supabase/ssr's
  // createBrowserClient, which persists the session in a COOKIE (not
  // localStorage): name `sb-<ref>-auth-token`, value `base64-` + base64url
  // JSON (createStorageFromOptions cookieEncoding: "base64url"). Seeding that
  // exact shape lets getSession() resolve the user with zero /auth/v1 calls.
  const storageKey = `sb-${resolveSupabaseRef()}-auth-token`;
  const session = buildSeededSession();
  // Belt and braces: far-future expiry means gotrue should never refresh, but
  // if it does, don't let a fake refresh token 400 against the real project
  // and silently sign the user out mid-test.
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
  await page.addInitScript(() => {
    window.localStorage.setItem("zane_ai_last_mode", "cs_assistant");
  });
}

test("ai assistant opens at the latest message and lazily fetches older pages on scroll-up", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);

  const olderRequests: Request[] = [];

  // Catch-all for the page's incidental reads (subjects, quizzes…)
  // — registered FIRST so the specific handlers below win.
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  // A filled profile keeps AcademicOnboardingGate from bouncing to
  // /onboarding/academic (it fires when level/semester are unknown-null).
  // useUserAcademic reads it with .maybeSingle(), hence the object shape.
  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({
      json: { id: USER_ID, level: 3, semester: 1, department_id: DEPARTMENT_ID },
    }),
  );
  await page.route("**/rest/v1/ai_chat_messages*", (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    if (offset > 0) olderRequests.push(route.request());
    route.fulfill({ json: ROWS.slice(offset, offset + limit) });
  });

  await seedAuthedSession(page, baseURL);
  await page.goto("/en/ai-assistant");

  const scroller = page.getByTestId("chat-messages-scroller");
  await expect(scroller).toBeVisible();
  // The newest message (last of the initial page) rendered. MSG-59 is unique
  // (ids are MSG-0..MSG-59), so substring matching stays unambiguous.
  await expect(page.getByText("MSG-59").first()).toBeVisible();
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);

  // The list must actually overflow the viewport, else the bottom assertion
  // is vacuous (30 bubbles of long markdown ≫ 720px).
  const dims = await scroller.evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
  }));
  expect(dims.sh).toBeGreaterThan(dims.ch + 500);

  // FIX under test: after the markdown chunk mounts (real heights), the view
  // must be pinned to the bottom — distance ≈ 0. Pre-fix the one-shot stick
  // ran against 1.5em placeholders and nothing re-fired it.
  await expect
    .poll(
      async () =>
        scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      { timeout: 20_000, message: "chat should open pinned to the latest message" },
    )
    .toBeLessThanOrEqual(120);

  // ── Scroll-up lazy sync (spec 011) ────────────────────────────────────────
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));

  // Top sentinel (rootMargin 200px) triggers loadOlder → offset=30 page.
  await expect
    .poll(() => olderRequests.length, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);
  expect(new URL(olderRequests[0].url()).searchParams.get("offset")).toBe("30");

  // The older page is prepended: the oldest rows (MSG-0 / MSG-29 live only in
  // the offset=30 slice) become present in the DOM.
  await expect(page.getByText("MSG-0").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("MSG-29").first()).toBeVisible();

  // The prepend anchor kept the viewport on the history the user was reading —
  // the view must NOT have been re-pinned to the bottom by the ResizeObserver
  // (near-bottom is false after the scroll-up).
  const distanceAfterPrepend = await scroller.evaluate(
    (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
  );
  expect(distanceAfterPrepend).toBeGreaterThan(200);
});
