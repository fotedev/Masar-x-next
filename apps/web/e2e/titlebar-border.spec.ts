import { expect, test, type Page } from "@playwright/test";

/**
 * Titlebar border e2e — spec 046 follow-up 3.
 *
 * Regression guard for the "white line at the top": `border-border` used to
 * generate NO CSS (no `--color-border` token in the @theme block), so the
 * titlebar's 1px bottom border painted with the base-layer #e5e7eb fallback
 * (spec-026 v3 defaults restoration) — a bright gray-200 line across the
 * dark desktop shell. The token is wired now; this pins the computed color
 * so a future token regression cannot silently resurrect the line.
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const GRAY_200 = "rgb(229, 231, 235)";

/**
 * Normalizes ANY computed color (rgb/oklab/color(srgb)/…) to sRGB bytes via
 * a 1×1 canvas fill — Chromium may serialize the wired hsl(var(--border))
 * token in a modern color space, so string-parsing rgb() is not enough.
 */
const MAX_CHANNEL_OF_BORDER = (el: Element): number => {
  const color = getComputedStyle(el).borderBottomColor;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Number.NaN;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const { data } = ctx.getImageData(0, 0, 1, 1);
  return Math.max(data[0], data[1], data[2]);
};

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

test.describe("titlebar border (desktop-mode simulation, spec 046)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("dark shell: titlebar bottom border uses the wired token, not gray-200", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await mockGuestApi(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
    });
    await page.addInitScript(DESKTOP_BRIDGE_STUB);
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);

    // DesktopShellGate honored the bridge + dark theme actually applied —
    // otherwise the light --border triplet would legitimately be bright.
    await expect(page.locator("html[data-masarx-desktop='true']")).toBeAttached({
      timeout: 15_000,
    });
    await expect(page.locator("html.dark")).toBeAttached();

    const titlebar = page.locator("header.masarx-titlebar");
    await expect(titlebar).toBeVisible();

    // The computed border color must be dark: the wired dark --border token
    // is hsl(217.2 32.6% 17.5%) ≈ slate-800; the dead-utility fallback was
    // #e5e7eb (max channel 235). Poll — the titlebar mounts post-hydration.
    await expect
      .poll(async () => titlebar.evaluate(MAX_CHANNEL_OF_BORDER), {
        timeout: 5_000,
      })
      .toBeLessThan(200);

    // And never the exact gray-200 fallback that drew the reported line.
    const color = await titlebar.evaluate(
      (el) => getComputedStyle(el).borderBottomColor,
    );
    expect(color).not.toBe(GRAY_200);

    expect(pageErrors, "no uncaught page errors").toEqual([]);
  });
});
