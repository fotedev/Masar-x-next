import { expect, test, type Page } from "@playwright/test";

/**
 * Sidenav rail e2e — spec 045.
 *
 * First sidenav coverage in the suite (the collapsible rail from PR #183
 * shipped with none; its verification was a manual visual pass). Two modes:
 *
 *  - Web mode (no bridge): collapsed 64px rail on ≥lg, logo-toggled
 *    expansion persisted in localStorage, below-lg mobile top bar, RTL
 *    anchoring via logical properties.
 *  - Desktop-mode simulation (spec 045): a `window.masarxDesktop`
 *    init-script stub — mirroring apps/desktop/src/main/preload.ts — makes
 *    the app render the rail inside the desktop shell, offset below the
 *    32px titlebar (desktop-shell.css) with web-only chrome (Footer)
 *    still suppressed. The real-shell drag-region behavior is covered by
 *    the packaged-app verification pass, not here (no Electron in e2e).
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

/** Mirrors the contextBridge surface in apps/desktop/src/main/preload.ts. */
const DESKTOP_BRIDGE_STUB = `
  (() => {
    const unsub = () => {};
    const asyncNoop = async () => undefined;
    window.masarxDesktop = {
      app: { version: async () => "0.0.0-e2e", openExternal: asyncNoop },
      auth: { rendererReady: async () => null, onDeepLink: () => unsub },
      updates: {
        installAndRestart: asyncNoop,
        skip: asyncNoop,
        onAvailable: () => unsub,
        onError: () => unsub,
      },
      window: {
        minimize: asyncNoop,
        toggleMaximize: async () => false,
        close: asyncNoop,
        isMaximized: async () => false,
        onMaximizeChange: () => unsub,
      },
    };
  })();
`;

test.describe("sidenav rail (web mode)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("collapsed rail is visible at ≥lg and expands via the logo toggle", async ({
    page,
  }) => {
    await mockGuestApi(page);
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    const rail = page.getByRole("complementary");
    await expect(rail).toBeVisible({ timeout: 15_000 });

    const collapsed = await rail.boundingBox();
    expect(collapsed?.width).toBe(64);
    expect(collapsed?.y).toBe(0); // no titlebar offset outside the shell

    const logoToggle = rail.locator("button[aria-expanded]");
    await expect(logoToggle).toHaveAttribute("aria-expanded", "false");
    await logoToggle.click();
    await expect(logoToggle).toHaveAttribute("aria-expanded", "true");

    // The toggle is debounced and the width animates over 300ms — poll to
    // the settled width instead of reading the box once (CI's prod build
    // hydrates faster than dev and would catch the transition mid-flight).
    await expect
      .poll(async () => (await rail.boundingBox())?.width, { timeout: 5_000 })
      .toBe(240);
  });

  test("expansion persists across a reload", async ({ page }) => {
    await mockGuestApi(page);
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    const rail = page.getByRole("complementary");
    await expect(rail).toBeVisible({ timeout: 15_000 });
    await rail.locator("button[aria-expanded]").click();
    await expect(rail.locator("button[aria-expanded]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect
      .poll(async () => (await rail.boundingBox())?.width, { timeout: 5_000 })
      .toBe(240);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("complementary")).toBeVisible({ timeout: 15_000 });
    // After reload the persisted expanded state applies post-mount with a
    // width transition — poll to the settled width, never read once.
    await expect
      .poll(async () => (await page.getByRole("complementary").boundingBox())?.width, {
        timeout: 5_000,
      })
      .toBe(240);
  });

  test("below-lg viewport swaps the rail for the mobile top bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await mockGuestApi(page);
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    await expect(page.getByRole("complementary")).toBeHidden();
    // The mobile top bar is the banner-role header below lg (the aside
    // also carries .z-header but resolves display:none at this width).
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("RTL anchors the rail to the inline start (right edge in /ar)", async ({
    page,
  }) => {
    await mockGuestApi(page);
    await page.goto("/ar", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    const rail = page.getByRole("complementary");
    await expect(rail).toBeVisible({ timeout: 15_000 });
    const box = await rail.boundingBox();
    // start-0 in RTL pins the rail to the right edge of a 1280px viewport.
    expect(box?.x).toBeCloseTo(1280 - 64, 0);
  });
});

test.describe("sidenav rail (desktop-mode simulation, spec 045)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("rail renders below the 32px titlebar and web-only chrome stays hidden", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await mockGuestApi(page);
    await page.addInitScript(DESKTOP_BRIDGE_STUB);
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    // DesktopShellGate flipped the root marker — the bridge was honored.
    await expect(page.locator("html[data-masarx-desktop='true']")).toBeAttached({
      timeout: 15_000,
    });

    // CustomTitlebar renders inside the shell.
    const titlebar = page.locator("header.masarx-titlebar");
    await expect(titlebar).toBeVisible();

    // The rail is NOT unmounted in desktop mode anymore (spec 045) and
    // starts below the 32px drag-region titlebar.
    const rail = page.getByRole("complementary");
    await expect(rail).toBeVisible({ timeout: 15_000 });
    const collapsed = await rail.boundingBox();
    expect(collapsed?.y).toBe(32);
    expect(collapsed?.width).toBe(64);

    // The logo toggle still works inside the shell (debounced + animated,
    // so poll to the settled width).
    await rail.locator("button[aria-expanded]").click();
    await expect(rail.locator("button[aria-expanded]")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect
      .poll(async () => (await rail.boundingBox())?.width, { timeout: 5_000 })
      .toBe(240);

    // Content clears the rail: the desktop root gained the lg:ps offset.
    const mainBox = await page.locator("main").boundingBox();
    expect(mainBox?.x).toBeGreaterThanOrEqual(64);

    // Web-only chrome stays desktop-hidden (unchanged FR-019 scope).
    await expect(page.locator("footer")).toHaveCount(0);

    expect(pageErrors, "no uncaught page errors").toEqual([]);
  });
});
