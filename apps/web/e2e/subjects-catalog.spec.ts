import { expect, test } from "@playwright/test";

/**
 * Subjects catalog e2e — spec 015 Contract E, re-baselined by spec 022.
 *
 * Anonymous, route-mocked variant: the academic grid must render the mocked
 * show_on_home subjects and must NEVER render the non-academic empty-state
 * copy on the academic grid (the old is_academic ternary bug — post-merge
 * this assertion also covers spec 015 scenario c).
 *
 * Signed-in variant with a student profile: DEFERRED — needs a portable seed
 * user (spec 015 §5 seed-portability concern). Skipped with a TODO rather
 * than flaking CI.
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const NON_ACADEMIC_EMPTY_COPY = /emptyNonAcademicTitle|emptyNonAcademicDescription/;

const MOCK_SUBJECTS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "تشريح",
    name_en: "Anatomy",
    is_academic: true,
    semester: 1,
    level: 1,
    show_on_home: true,
    created_at: "2025-01-01T00:00:00Z",
    status: "approved",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "فسيولوجي",
    name_en: "Physiology",
    is_academic: true,
    semester: 1,
    level: 1,
    show_on_home: true,
    created_at: "2025-01-02T00:00:00Z",
    status: "approved",
  },
];

test.describe("subjects catalog (anonymous, route-mocked)", () => {
  test("renders mocked subject cards on /ar/subjects without non-academic copy", async ({
    page,
  }) => {
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { id: null, email: null, aud: null } }),
    );
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({ json: { error: "no_session" } }),
    );
    await page.route("**/rest/v1/subjects*", (route) =>
      route.fulfill({ json: MOCK_SUBJECTS }),
    );
    await page.route("**/rest/v1/profiles*", (route) => route.fulfill({ json: null }));

    await page.goto("/ar/subjects", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    await expect(
      page.getByRole("button", { name: /تشريح|Anatomy/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /فسيولوجي|Physiology/ })).toBeVisible();

    // Regression: the academic grid must never show the non-academic
    // empty-state copy (or the i18n key itself leaked as text).
    await expect(page.locator("body")).not.toContainText(NON_ACADEMIC_EMPTY_COPY);
  });
});

test.describe("subjects catalog (signed-in student)", () => {
  // TODO(spec 015 §5): requires a portable seed user (profile semester=1,
  // level=1). Skip until the seed fixtures land in playwright.config/env.
  test.skip("a semester-1 student sees their subjects", async () => {
    test.info().annotations.push({
      type: "spec-022",
      description: "Blocked on seed portability — see spec 015 §5 / spec 022 §2.2",
    });
  });
});
