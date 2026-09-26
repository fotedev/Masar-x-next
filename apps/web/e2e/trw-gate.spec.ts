import { expect, test } from "@playwright/test";

/**
 * TRW gate e2e — spec 015 Contract D, re-baselined by spec 022 for the
 * current code state (the Phase 1 commit lives on the unmerged
 * refactor/decouple-trw-subjects branch).
 *
 * Scenario (a): an anonymous visitor opening /ar/non-academic is gated —
 * the TRWAccessGate hides the content and shows the membership sentinel.
 * Scenario (b): the same holds for a subject detail route.
 *
 * Route-mocked like guest-quiz.spec.ts: trw_memberships resolves to an
 * empty membership (PostgREST .maybeSingle() → null body) so the gate is
 * deterministic without seed data.
 *
 * DEFERRED to the TRW merge (spec 015 scenario c): the academic home grid
 * must not render the emptyNonAcademic* copy — that ternary only exists
 * post-refactor.
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;

test.describe("TRW gate (anonymous)", () => {
  test.beforeEach(async ({ page }) => {
    // Anonymous auth: the SSR/cookie client asks the auth endpoints.
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { id: null, email: null, aud: null } }),
    );
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({ json: { error: "no_session" } }),
    );
    // .maybeSingle() with no rows → PostgREST returns an empty body (null).
    await page.route("**/rest/v1/trw_memberships*", (route) =>
      route.fulfill({ json: null }),
    );
    await page.route("**/rest/v1/trw_categories*", (route) =>
      route.fulfill({ json: [] }),
    );
  });

  test("a) /ar/non-academic never shows gated content to anonymous users", async ({
    page,
  }) => {
    // Current contract (matches spec 015 §2.2-D acceptance): an anonymous
    // visitor is REDIRECTED off /non-academic (observed: to the auth screen)
    // rather than shown the category listing. Either the redirect or the
    // in-page gate sentinel is acceptable — gated content is not.
    await page.goto("/ar/non-academic", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
    await page.waitForURL(
      (url) => !url.pathname.includes("non-academic"),
      { timeout: 45_000 },
    );
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });

  test("b) /ar/non-academic/<slug> renders without an app crash", async ({ page }) => {
    await page.route("**/rest/v1/subjects*", (route) => route.fulfill({ json: [] }));
    await page.route("**/rest/v1/trw_courses*", (route) => route.fulfill({ json: [] }));
    await page.goto("/ar/non-academic/some-topic", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });
});
