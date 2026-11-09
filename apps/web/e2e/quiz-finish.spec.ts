import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Authed quiz loop → server-authoritative finish (spec 030 contract).
 *
 * SSR WALL (why this spec drives the client fallback): /quiz-play/[quizId]
 * fetches the payload SERVER-side (spec 033 Track A) — page.route() cannot
 * intercept the Next server's Supabase calls. We deliberately use a quiz id
 * that does NOT exist in the DB, so the SSR fetch yields null and
 * QuizPlayer falls through to the CLIENT-side quizService.getQuiz retry,
 * which page.route() DOES intercept (same trick guest-quiz.spec.ts uses).
 *
 * With the attempt hooks route-mocked (quiz_attempts select/insert,
 * quiz_answers upsert, finish_quiz_attempt RPC), the full loop runs:
 * start → answer → submit → next (last question) → results.
 *
 * Spec 030 contract under test: the results card shows the SERVER's
 * re-graded numbers (7/10 → 70%) — NOT the client's own 1/1 → 100%
 * computation — and, because the user is authed, the guest notice is
 * absent. expect() polls through the transient client-score render until
 * the authoritative values land.
 */

const USER_ID = "00000000-0000-4000-8000-00000000e2e2";
const DEPARTMENT_ID = "00000000-0000-4000-8000-00000000d3p7";
const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const GUEST_ATTEMPT_NOTICE = "أنت تعمل في وضع الضيف";

// Valid uuid shape that matches no real row → the SSR .single() read fails.
const QUIZ_ID = "00000000-0000-4000-8000-0000000000e2";
const ATTEMPT_ID = "00000000-0000-4000-8000-0000000000a1";

const MOCK_QUIZ = {
  id: QUIZ_ID,
  title: "اختبار إنهاء E2E",
  description: null,
  status: "approved",
  duration_seconds: 600,
  user_id: USER_ID,
  source_type: "ai_generated",
};

const MOCK_QUESTIONS = [
  {
    id: "q1",
    quiz_id: QUIZ_ID,
    question: "سؤال تجريبي للإنهاء؟",
    options: ["الخيار الصحيح", "الخيار الخطأ"],
    correct_answer: 0,
    explanation: "شرح",
    image_url: null,
    order_index: 0,
  },
];

const ATTEMPT_ROW = {
  id: ATTEMPT_ID,
  quiz_id: QUIZ_ID,
  user_id: USER_ID,
  score: 0,
  total_questions: 0,
  started_at: new Date().toISOString(),
  finished_at: null,
  status: "in_progress",
  answers: [],
};

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
      "quiz-finish.spec: NEXT_PUBLIC_SUPABASE_URL not found (env or apps/web/.env.local) — cannot derive the supabase-js localStorage key",
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
}

test("authed quiz loop finishes with the server-graded score (7/10 → 70%)", async ({
  page,
  baseURL,
}) => {
  // Catch-all for incidental reads — registered FIRST so the specific
  // handlers below win (LIFO).
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({
      json: { id: USER_ID, level: 3, semester: 1, department_id: DEPARTMENT_ID },
    }),
  );
  // Client fallback fetch (quizService.getQuiz): .single() → object shape,
  // questions → array.
  await page.route("**/rest/v1/quizzes?*", (route) =>
    route.fulfill({ json: MOCK_QUIZ }),
  );
  await page.route("**/rest/v1/quiz_questions?*", (route) =>
    route.fulfill({ json: MOCK_QUESTIONS }),
  );
  // startAttempt: GET (existing-attempt probe, .maybeSingle() → null) then
  // POST insert (.select().single() → object shape).
  await page.route("**/rest/v1/quiz_attempts*", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ json: ATTEMPT_ROW });
    }
    return route.fulfill({ json: null });
  });
  // saveAnswer upsert — result is only checked for errors.
  await page.route("**/rest/v1/quiz_answers*", (route) =>
    route.fulfill({ json: [] }),
  );
  // Spec 030: the server re-grades and returns the trusted numbers.
  await page.route("**/rest/v1/rpc/finish_quiz_attempt", (route) =>
    route.fulfill({ json: { score: 7, total_questions: 10 } }),
  );

  await seedAuthedSession(page, baseURL);
  await page.goto(`/ar/quiz-play/${QUIZ_ID}`);

  await expect(page.getByTestId("quiz-start-button")).toBeVisible();
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);
  await page.getByTestId("quiz-start-button").click();

  // Question screen (single question): pick the correct option, submit, and
  // "next" on the last question finishes the attempt.
  await expect(page.getByTestId("quiz-submit-answer")).toBeVisible();
  await page.getByTestId("quiz-option-button").first().click();
  await page.getByTestId("quiz-submit-answer").click();
  await page.getByTestId("quiz-next").click();

  await expect(page.getByTestId("quiz-results-card")).toBeVisible();
  // Server-authoritative numbers (spec 030): the RPC's 7/10 re-graded
  // result, not the client's own 1/1. The card first paints with the client
  // computation; expect() polls until the server result patches it.
  await expect(page.getByTestId("quiz-results-score")).toHaveText("70%");
  await expect(page.getByTestId("quiz-results-card")).toContainText("7/10");
  await expect(page.getByTestId("quiz-retry")).toBeVisible();

  // Authed user → the guest notice (question and results screens) is absent.
  await expect(page.getByText(GUEST_ATTEMPT_NOTICE)).toHaveCount(0);
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);
});
