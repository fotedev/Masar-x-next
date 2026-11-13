import { expect, test } from "@playwright/test";

/**
 * Schedules page — spec 034 surface enhanced by spec 047: the section
 * matrix (block/day chips + time × sections table) is the default view;
 * the faithful raw grid stays reachable via the view toggle (spec 034
 * contract preserved on that path).
 */

test.describe("schedules (spec 034 + 047)", () => {
  test("defaults to the section-matrix view; raw grid reachable via toggle", async ({
    page,
  }) => {
    await page.goto("/ar/schedules");

    await expect(page.getByTestId("schedules-tabs")).toBeVisible();
    const tabs = page.getByTestId("schedules-tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.filter({ hasText: "الفرقة الثانية" })).toBeVisible();

    // Spec 047 default: section matrix with block chips + day chips.
    await expect(page.getByTestId("schedules-timetable")).toBeVisible();
    await expect(page.getByTestId("schedules-block").first()).toBeVisible();
    await expect(page.getByTestId("schedules-day").first()).toBeVisible();
    await expect(
      page.getByTestId("schedules-timetable").locator("thead th").first(),
    ).toBeVisible();
    const matrixCells = page
      .getByTestId("schedules-timetable")
      .locator("tbody td");
    expect(await matrixCells.count()).toBeGreaterThan(10);

    // Raw faithful grid (spec 034 contract) via the view toggle.
    await page.getByTestId("schedules-view-raw").click();
    await expect(page.getByTestId("schedules-grid")).toBeVisible();
    await expect(
      page.getByTestId("schedules-grid").locator("thead th").first(),
    ).toBeVisible();
    const cells = page.getByTestId("schedules-grid").locator("tbody td");
    expect(await cells.count()).toBeGreaterThan(20);

    // Switching cohorts swaps the grid content (الفرقة الثانية is denser;
    // the view toggle persists across cohort switches).
    await tabs.filter({ hasText: "الفرقة الثانية" }).click();
    await expect(
      page.getByTestId("schedules-grid").locator("table").first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("schedules-grid").getByText("هياكل البيانات", { exact: false }).first(),
    ).toBeVisible();

    // The matrix view also renders for the denser cohort.
    await page.getByTestId("schedules-view-timetable").click();
    await expect(page.getByTestId("schedules-timetable")).toBeVisible();
  });

  test("renders in English locale too (localized tabs)", async ({ page }) => {
    await page.goto("/en/schedules");
    await expect(page.getByRole("heading", { name: "Schedules" })).toBeVisible();
    await expect(page.getByTestId("schedules-tab")).toHaveCount(4);
    await expect(
      page.getByTestId("schedules-tab").filter({ hasText: "Second Year" }),
    ).toBeVisible();
    await expect(page.getByTestId("schedules-timetable")).toBeVisible();
  });
});
