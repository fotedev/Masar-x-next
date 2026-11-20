import { expect, test, type Page } from "@playwright/test";

/**
 * Footer route scope e2e (owner decision 2026-11-20).
 *
 * The footer renders ONLY on info/utility routes (footerRoutes.ts allowlist);
 * studying pages ship footer-free by default. Public info pages are checked
 * with the same anonymous route-mocked guest pattern as subjects-catalog
 * (no seed user needed). The desktop-shell case — footer count 0 on any
 * route — is already covered by sidenav.spec.ts's desktop-mode simulation.
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;

/** Hermetic guest: no auth session, empty content tables. */
async function mockGuestApi(page: Page): Promise<void> {
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ json: { id: null, email: null, aud: null } }),
  );
  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({ json: { error: "no_session" } }),
  );
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
}

test.describe("footer route scope (web mode)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("info/utility pages keep the footer", async ({ page }) => {
    await mockGuestApi(page);

    for (const route of ["/en", "/en/downloads", "/en/faq"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
      await expect(
        page.locator("footer"),
        `${route} keeps the footer`,
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("studying pages ship footer-free", async ({ page }) => {
    await mockGuestApi(page);

    for (const route of ["/en/subjects", "/en/quizzes", "/en/schedules"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
      await expect(page.locator("footer"), `${route} has no footer`).toHaveCount(0);
    }
  });
});
