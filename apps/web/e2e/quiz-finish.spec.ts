import { expect, test } from "@playwright/test";

import { seedAuthedSession } from "./helpers/auth";

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

  await seedAuthedSession(page, { baseURL, userId: USER_ID });
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
