import { expect, test } from "@playwright/test";

/**
 * Materials e2e — spec 033.
 *
 * The /materials page is static-data driven (manifest.json + Zod), so the
 * anonymous, unmocked variant is deterministic: 20 subjects (7 Y2-S1 crawled,
 * 13 Y1-S1 stubs), term filter chips, group chips, and the Drive iframe.
 * The seeded real exams are verified in production by the migration's count
 * queries (spec 033 §Contracts); here we assert the /materials → /quizzes
 * navigation and that the quizzes page renders without the seeded titles
 * being filtered out (subject filter options come from the subjects table,
 * which intentionally has no Y2-S1 rows yet).
 */

test.describe("materials (spec 033)", () => {
  test("renders 20 subjects with term badges and filter chips", async ({
    page,
  }) => {
    await page.goto("/ar/materials");

    await expect(page.getByTestId("materials-subject-grid")).toBeVisible();
    const cards = page.getByTestId("materials-subject-card");
    await expect(cards).toHaveCount(20);

    // Term filter chips: two terms present in the manifest (Y2-S1 + Y1-S1) + "all".
    // exact: true — subject cards' accessible names also contain the term text.
    await expect(
      page.getByRole("button", { name: "المستوى 2 · الفصل 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "المستوى 1 · الفصل 1", exact: true }),
    ).toBeVisible();

    // Term filter narrows the grid to the 7 crawled Y2-S1 subjects.
    await page
      .getByRole("button", { name: "المستوى 2 · الفصل 1", exact: true })
      .click();
    await expect(page.getByTestId("materials-subject-card")).toHaveCount(7);
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

  test("crawled subject opens groups, file list, and builds a Drive iframe", async ({
    page,
  }) => {
    await page.goto("/ar/materials");

    await page
      .getByTestId("materials-subject-card")
      .filter({ has: page.getByText("اتصالات البيانات") })
      .click();

    // First group is auto-selected; its file list renders.
    const files = page.getByRole("button", { name: /\.pdf$|\.txt$|\.pptx$|\.docx$/ });
    await expect(files.first()).toBeVisible();

    // Selecting a file builds the embedded Drive viewer iframe.
    await files.first().click();
    const iframe = page.getByTestId("materials-drive-iframe");
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute(
      "src",
      /https:\/\/drive\.google\.com\/file\/d\/[^/]+\/preview/,
    );

    // Back to the grid works.
    await page.getByRole("button", { name: "كل المواد" }).click();
    await expect(page.getByTestId("materials-subject-card")).toHaveCount(20);
  });

  test("links to quizzes and the quizzes page loads", async ({ page }) => {
    await page.goto("/ar/materials");

    await page
      .getByTestId("materials-subject-card")
      .filter({ has: page.getByText("اتصالات البيانات") })
      .click();
    await page.getByRole("link", { name: "اذهب إلى الاختبارات" }).click();
    await expect(page).toHaveURL(/\/quizzes$/);

    // NOTE (spec 033): the seeded exam TITLES are intentionally NOT asserted
    // here. The quizzes UI scopes subject options (and the anonymous
    // allowedSubjects guard) to the viewer's own level/semester via
    // useSubjects — a level-2/semester-1 student sees the seeded exams,
    // exactly like every other subject-scoped quiz. Anonymous visitors see
    // level-1 subjects only, by app design. The exams themselves are
    // verified in prod by the seed migrations' count queries.
    await expect(page.getByRole("heading", { name: "الامتحانات" })).toBeVisible();
  });
});
