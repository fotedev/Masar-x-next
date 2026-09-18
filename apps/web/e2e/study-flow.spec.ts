import { expect, test, type Page } from "@playwright/test";

/**
 * Public happy-path study-flow smoke — Spec 010 (MVP report G6.1).
 *
 * Two assertion layers (owner decision 2026-09-17: public path only, no secrets):
 *  1. Shell assertions — always run, CI and local: home + subjects render, html
 *     dir matches locale, no error boundary.
 *  2. Data-dependent assertions — run only when public subject data is reachable;
 *     otherwise soft-skip so a data-less environment (CI placeholders) still
 *     proves the shells instead of failing spuriously.
 */

const LOCALES = ["ar", "en"] as const;

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;

async function expectNoErrorBoundary(page: Page) {
  await expect(page.getByText(ERROR_BOUNDARY)).toHaveCount(0);
}

for (const locale of LOCALES) {
  test(`home renders — ${locale}`, async ({ page }) => {
    const res = await page.goto(`/${locale}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.locator("main")).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test(`subjects shell renders — ${locale}`, async ({ page }) => {
    const res = await page.goto(`/${locale}/subjects`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test(`subject detail opens — ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/subjects`);
    // SubjectsGrid renders skeleton divs while loading and real <button> cards
    // once subjects arrive; the empty state renders no buttons.
    const cards = page.locator("main").getByRole("button");
    try {
      await expect
        .poll(async () => cards.count(), { timeout: 15_000, intervals: [500, 1_000, 5_000] })
        .toBeGreaterThan(0);
    } catch {
      test.skip(true, "no public subject data reachable (shell assertions still apply)");
    }
    await cards.first().click();
    await page.waitForURL(/\/subjects\/.+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);

    // Lecture step: only if the subject page exposes real links deeper.
    const lectureLink = page.locator('main a[href*="/lectures"]').first();
    if ((await lectureLink.count()) > 0) {
      await lectureLink.click();
      await expectNoErrorBoundary(page);
    }
  });
}
