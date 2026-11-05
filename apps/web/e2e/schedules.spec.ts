import { expect, test } from "@playwright/test";

/**
 * Schedules page — spec 034. Static-data surface: 4 cohort timetables
 * (الفرقة الأولى..الرابعة) extracted from the public announced sheet.
 * Every tab must render a populated grid (day/hour rows with content).
 */

test.describe("schedules (spec 034)", () => {
  test("renders 4 cohort tabs and a populated grid per cohort", async ({
    page,
  }) => {
    await page.goto("/ar/schedules");

    await expect(page.getByTestId("schedules-tabs")).toBeVisible();
    const tabs = page.getByTestId("schedules-tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.filter({ hasText: "الفرقة الثانية" })).toBeVisible();

    // First tab (الفرقة الأولى) renders a grid with a sticky header + rows.
    await expect(page.getByTestId("schedules-grid")).toBeVisible();
    await expect(page.getByTestId("schedules-grid").locator("thead th").first()).toBeVisible();
    const cells = page.getByTestId("schedules-grid").locator("tbody td");
    expect(await cells.count()).toBeGreaterThan(20);

    // Switching cohorts swaps the grid content (الفرقة الثانية is denser).
    await tabs.filter({ hasText: "الفرقة الثانية" }).click();
    await expect(
      page.getByTestId("schedules-grid").locator("table").first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("schedules-grid").getByText("هياكل البيانات", { exact: false }).first(),
    ).toBeVisible();
  });

  test("renders in English locale too", async ({ page }) => {
    await page.goto("/en/schedules");
    await expect(page.getByRole("heading", { name: "Schedules" })).toBeVisible();
    await expect(page.getByTestId("schedules-tab")).toHaveCount(4);
  });
});
