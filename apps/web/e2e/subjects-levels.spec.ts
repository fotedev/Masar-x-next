import { expect, test } from "@playwright/test";

/**
 * Subjects level tabs — spec 034. Anonymous, live-data variant:
 * the /subjects catalog fetches every level (allLevels) and the tab bar
 * filters client-side. Switching to المستوى الثاني must reveal the seeded
 * Y2-S1 subjects (spec 033), which the old profile-scoped query could
 * never show a level-1 visitor.
 */

test.describe("subjects level tabs (spec 034)", () => {
  test("renders level tabs and switches to level 2 subjects", async ({
    page,
  }) => {
    await page.goto("/ar/subjects");

    const tabs = page.getByTestId("subjects-level-tab");
    await expect(tabs.first()).toBeVisible();
    // academic_levels seeds 4 levels
    await expect(tabs).toHaveCount(4);

    // Level 2 tab reveals the Y2-S1 subjects (data structures etc.).
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-pressed", "true");

    const grid = page.getByRole("button");
    await expect(grid.filter({ hasText: "اتصالات البيانات" })).toBeVisible();
    await expect(grid.filter({ hasText: "البرمجة الكائنية" })).toBeVisible();
    await expect(grid.filter({ hasText: "التركيبات المنفصلة" })).toBeVisible();

    // Demo subjects are gone from every tab (spec 034 cleanup).
    await expect(page.getByText("FOTE", { exact: true })).toHaveCount(0);
    await tabs.first().click();
    await expect(page.getByText("FOTE", { exact: true })).toHaveCount(0);
  });
});
