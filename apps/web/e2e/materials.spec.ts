import { expect, test } from "@playwright/test";

/**
 * Materials e2e — spec 033, re-baselined 2026-11-05 (owner decision):
 * level/semester selection lives in the profile, so the term filter chips
 * are gone and the static manifest is filtered to the viewer's profile
 * level+semester. Anonymous variant: guests resolve to level 1 + platform
 * default semester (mocked to 1) → the 13 Y1-S1 stub subjects. The
 * signed-in Y2-S1 variant is covered by the useMaterialsData unit tests —
 * Playwright has no portable seed session yet (same deferral as
 * subjects-catalog.spec.ts).
 */

test.describe("materials (profile-scoped, anonymous)", () => {
  test.beforeEach(async ({ page }) => {
    // Deterministic guest semester: platform_settings resolves to nothing
    // (PGRST116) → the hook falls back to the hardcoded default semester 1.
    await page.route("**/rest/v1/platform_settings*", (route) =>
      route.fulfill({
        status: 406,
        json: { code: "PGRST116", details: null, hint: null, message: "0 rows" },
      }),
    );
  });

  test("guest sees only their fallback term's subjects, no filter chips", async ({
    page,
  }) => {
    await page.goto("/ar/materials");

    await expect(page.getByTestId("materials-subject-grid")).toBeVisible();
    // 13 Y1-S1 stubs — the 7 crawled Y2-S1 subjects need a level-2 profile.
    await expect(page.getByTestId("materials-subject-card")).toHaveCount(13);

    // Term filter chips are gone (profile-driven selection).
    await expect(
      page.getByRole("button", { name: "المستوى 2 · الفصل 1", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "المستوى 1 · الفصل 1", exact: true }),
    ).toHaveCount(0);
  });

  test("stub subjects show the coming-soon state", async ({ page }) => {
    await page.goto("/ar/materials");

    // fundamentals-of-it is a Y1-S1 stub (no Drive folder yet).
    await page
      .getByTestId("materials-subject-card")
      .filter({ has: page.getByText("أساسيات تكنولوجيا المعلومات") })
      .click();
    await expect(page.getByTestId("materials-coming-soon")).toBeVisible();
    await expect(page.getByTestId("materials-drive-viewer")).toHaveCount(0);
  });

  test("crawled Y2-S1 subjects are out of a guest's scope", async ({ page }) => {
    await page.goto("/ar/materials");

    // اتصالات البيانات is Y2-S1 — invisible at the guest fallback level 1.
    // The Drive viewer flow it powers is unchanged; its profile-driven
    // reachability is covered by the useMaterialsData unit tests.
    await expect(
      page
        .getByTestId("materials-subject-card")
        .filter({ has: page.getByText("اتصالات البيانات") }),
    ).toHaveCount(0);
  });
});
