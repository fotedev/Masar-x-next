import { expect, test, type Request } from "@playwright/test";

/**
 * Guest quiz-play smoke — pre-launch punch list P0-3
 * (docs/audits/mvp-readiness-audit-2026-09-18/00-executive-summary.md).
 *
 * Route-mocked rather than data-driven: the guest quizzes dashboard
 * legitimately filters to quizzes whose subject matches a known subject
 * (useQuizzesFilters `allowedSubjects`), so reaching a real play button as a
 * guest depends on content-entry state. Mocking the two PostgREST reads makes
 * the flow deterministic in CI and local alike.
 *
 * The fix under test: QuizPlayer previously passed `user?.id || "guest"` into
 * the attempt hook, so every guest mount fired
 * `quiz_attempts?...&user_id=eq.guest` — a literal cast against a uuid column
 * (PGRST 400, swallowed). Guests must now fire ZERO quiz_attempts requests,
 * and `isGuest` must be true so the in-player guest notice renders (it was
 * previously false for real guests).
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const GUEST_ATTEMPT_NOTICE = "أنت تعمل في وضع الضيف";
const START_BUTTON = "ابدأ الآن";

const QUIZ_ID = "00000000-0000-4000-8000-000000000000";
const MOCK_QUIZ = {
  id: QUIZ_ID,
  title: "اختبار تجريبي للضيف",
  description: null,
  status: "approved",
  duration_seconds: 600,
  user_id: null,
  source_type: "ai_generated",
};
const MOCK_QUESTIONS = [
  {
    id: "q1",
    quiz_id: QUIZ_ID,
    question: "سؤال تجريبي؟",
    options: ["خيار أ", "خيار ب"],
    correct_answer: 0,
    explanation: "شرح",
    image_url: null,
    order_index: 0,
  },
];

test("guest plays a quiz without any quiz_attempts request and sees the guest notice", async ({
  page,
}) => {
  const attemptRequests: Request[] = [];
  page.on("request", (req: Request) => {
    if (req.url().includes("/rest/v1/quiz_attempts")) {
      attemptRequests.push(req);
    }
  });

  // getQuiz reads the quiz row with .single() (PostgREST object shape) and
  // the questions as an array.
  await page.route("**/rest/v1/quizzes?*", (route) =>
    route.fulfill({ json: MOCK_QUIZ }),
  );
  await page.route("**/rest/v1/quiz_questions?*", (route) =>
    route.fulfill({ json: MOCK_QUESTIONS }),
  );

  await page.goto(`/ar/quiz-play/${QUIZ_ID}`);
  await expect(page.getByRole("button", { name: START_BUTTON })).toBeVisible();
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);

  await page.getByRole("button", { name: START_BUTTON }).click();

  // The guest notice renders on the question screen only when isGuest is
  // computed correctly — the second half of the fix under test.
  await expect(page.getByText(GUEST_ATTEMPT_NOTICE)).toBeVisible();
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);

  // The bug under test fired a quiz_attempts query on every guest mount;
  // after the fix the attempt hook skips the DB entirely for guests.
  expect(attemptRequests).toEqual([]);
});
