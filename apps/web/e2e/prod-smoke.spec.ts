import { expect, test, type Request, type Response } from "@playwright/test";

/**
 * S1 launch-smoke against PRODUCTION (docs/LAUNCH_SIGNOFF.md §S1) — guest
 * quiz-play on real data. Complements e2e/guest-quiz.spec.ts (which is
 * route-mocked and therefore deterministic everywhere): this one proves the
 * same contract against the live site —
 *   - the approved seeded quiz loads via real REST (no mocks),
 *   - zero quiz_attempts requests from a guest mount,
 *   - the in-player guest notice renders.
 *
 * Runs only when E2E_PROD_URL is set (e.g. https://masarx.vercel.app) so CI
 * and local runs skip it; invoke with:
 *   E2E_BASE_URL=$URL E2E_PROD_URL=$URL pnpm --filter web test:e2e -- prod-smoke
 * (E2E_BASE_URL also disables the local webServer in playwright.config.ts.)
 */

const PROD_URL = process.env.E2E_PROD_URL;
const QUIZ_ID = process.env.E2E_PROD_QUIZ_ID ?? "7bbf857a-5c74-4f9e-8327-894651ae7152";

test.skip(!PROD_URL, "E2E_PROD_URL not set — production smoke is opt-in");

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const GUEST_ATTEMPT_NOTICE = "أنت تعمل في وضع الضيف";
const START_BUTTON = "ابدأ الآن";

test("S1 prod: guest plays the live approved quiz with zero attempt requests", async ({
  page,
}) => {
  const attemptRequests: Request[] = [];
  const badRestResponses: Response[] = [];
  page.on("request", (req: Request) => {
    if (req.url().includes("/rest/v1/quiz_attempts")) attemptRequests.push(req);
  });
  page.on("response", (res: Response) => {
    if (res.url().includes("/rest/v1/") && res.status() >= 400) {
      badRestResponses.push(res);
    }
  });

  await page.goto(`/ar/quiz-play/${QUIZ_ID}`);

  // Real data must load: the start screen renders from the live REST fetch.
  await expect(page.getByRole("button", { name: START_BUTTON })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);

  await page.getByRole("button", { name: START_BUTTON }).click();

  await expect(page.getByText(GUEST_ATTEMPT_NOTICE)).toBeVisible();
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);

  // A quiz with zero questions renders the failure card instead — that would
  // be a prod data problem, not a pass.
  await expect(page.getByText("فشل تحميل الاختبار")).toHaveCount(0);

  expect(attemptRequests, "guests must not fire quiz_attempts requests").toEqual([]);
  expect(badRestResponses, "no 4xx/5xx REST calls in the whole guest flow").toEqual([]);
});
