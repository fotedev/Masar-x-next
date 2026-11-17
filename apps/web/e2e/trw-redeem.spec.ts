import { expect, test, type Page } from "@playwright/test";

import { seedAuthedSession } from "./helpers/auth";

/**
 * TRW access-code redeem (spec 040 Wave 9).
 *
 * /trw/redeem is NOT behind the TRWAccessGate (that gate lives on the
 * /non-academic content routes, not on the redeem form), so an anonymous
 * visitor reaches the form directly — scenario (a) pins that.
 *
 * The authed scenarios drive the trw_redeem_access_code RPC through its
 * three outcomes, using the shared seeded-cookie auth helper
 * (e2e/helpers/auth.ts): an `sb-<ref>-auth-token` cookie (`@supabase/ssr`
 * cookieEncoding), so getSession() resolves with zero /auth/v1 calls. The RPC responses are
 * route-mocked (the hook is a client-side supabase.rpc call, fully
 * interceptable — no SSR fetch on this page).
 *
 * Error surfacing is sonner toasts (there is no inline error element on
 * the page, so no trw-redeem-error testid exists); the success toast is
 * followed by router.push to /{locale}/non-academic.
 */

const USER_ID = "00000000-0000-4000-8000-00000000e2e1";
const DEPARTMENT_ID = "00000000-0000-4000-8000-00000000d3p7";
const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;
const ACCESS_CODE = "TRW-E2E1-TEST";

const TRW_SUCCESS_TOAST = "تم تفعيل الاشتراك بنجاح في خطة premium_yearly.";
const TRW_INVALID_TOAST = "الكود غير صحيح، منتهي الصلاحية، أو تم استنفد عدد مرات الاستخدام.";
const TRW_ALREADY_TOAST = "لقد قمت بتفعيل هذا الكود مسبقاً.";

/** Register the redeem RPC mock — registered after the rest catch-all so it wins (LIFO). */
async function mockRedeemRpc(
  page: Page,
  response: Record<string, unknown>,
): Promise<void> {
  await page.route("**/rest/v1/rpc/trw_redeem_access_code", (route) =>
    route.fulfill({ json: response }),
  );
}

test.describe("TRW redeem page", () => {
  test.describe("anonymous", () => {
    test.beforeEach(async ({ page }) => {
      // Anonymous auth: the SSR/cookie client asks the auth endpoints
      // (same anon mocks as trw-gate.spec.ts).
      await page.route("**/auth/v1/user", (route) =>
        route.fulfill({ json: { id: null, email: null, aud: null } }),
      );
      await page.route("**/auth/v1/token*", (route) =>
        route.fulfill({ json: { error: "no_session" } }),
      );
    });

    // The redeem FORM is reachable without a gate — the membership gate
    // protects the /non-academic content, not the code entry point.
    test("reaches the redeem form without being bounced", async ({ page }) => {
      await page.goto("/ar/trw/redeem");
      await expect(page.getByTestId("trw-redeem-input")).toBeVisible();
      await expect(page.getByTestId("trw-redeem-submit")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
    });
  });

  test.describe("authed (seeded cookie)", () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
      // Filled profile keeps AcademicOnboardingGate from bouncing to
      // /onboarding/academic (same reason as ai-chat-history.spec.ts).
      await page.route("**/rest/v1/profiles*", (route) =>
        route.fulfill({
          json: { id: USER_ID, level: 3, semester: 1, department_id: DEPARTMENT_ID },
        }),
      );
      await seedAuthedSession(page, { baseURL, userId: USER_ID });
    });

    test("success response toasts the plan and routes to /non-academic", async ({ page }) => {
      await mockRedeemRpc(page, { success: true, plan_slug: "premium_yearly" });
      // The landing page gates on membership; return an active row so the
      // post-redirect /non-academic render is deterministic.
      await page.route("**/rest/v1/trw_memberships*", (route) =>
        route.fulfill({
          json: {
            id: "m-e2e",
            user_id: USER_ID,
            plan_slug: "premium_yearly",
            status: "active",
            revoked_at: null,
            expires_at: null,
            plan: {},
          },
        }),
      );

      await page.goto("/ar/trw/redeem");
      await page.getByTestId("trw-redeem-input").fill(ACCESS_CODE);
      // Wait for the client-hydrated enabled state — a pre-hydration click
      // on this page silently no-ops under parallel first-compile load.
      await expect(page.getByTestId("trw-redeem-submit")).toBeEnabled();
      await page.getByTestId("trw-redeem-submit").click();

      await expect(page.getByText(TRW_SUCCESS_TOAST)).toBeVisible();
      // The success path pushes /{locale}/non-academic. The seeded session's
      // JWT is client-truth only — /non-academic's SERVER gate can't see it
      // and redirects to /login (then AuthContext bounces to /ar) — so the
      // assertable contract is "navigation left the redeem form", not the
      // landing page (that landing needs a real session, out of scope here).
      await page.waitForURL(
        (url) => !url.pathname.includes("/trw/redeem"),
        { timeout: 30_000 },
      );
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
    });

    test("invalid_or_expired_code toasts its localized message and stays on the form", async ({
      page,
    }) => {
      await mockRedeemRpc(page, { success: false, error: "invalid_or_expired_code" });

      await page.goto("/ar/trw/redeem");
      await page.getByTestId("trw-redeem-input").fill(ACCESS_CODE);
      await expect(page.getByTestId("trw-redeem-submit")).toBeEnabled();
      await page.getByTestId("trw-redeem-submit").click();

      await expect(page.getByText(TRW_INVALID_TOAST)).toBeVisible();
      expect(page.url()).toContain("/trw/redeem");
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
    });

    test("already_redeemed toasts its localized message and stays on the form", async ({
      page,
    }) => {
      await mockRedeemRpc(page, { success: false, error: "already_redeemed" });

      await page.goto("/ar/trw/redeem");
      await page.getByTestId("trw-redeem-input").fill(ACCESS_CODE);
      await expect(page.getByTestId("trw-redeem-submit")).toBeEnabled();
      await page.getByTestId("trw-redeem-submit").click();

      await expect(page.getByText(TRW_ALREADY_TOAST)).toBeVisible();
      expect(page.url()).toContain("/trw/redeem");
      await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
    });
  });
});
