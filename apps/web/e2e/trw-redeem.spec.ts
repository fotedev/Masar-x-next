import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * TRW access-code redeem (spec 040 Wave 9).
 *
 * /trw/redeem is NOT behind the TRWAccessGate (that gate lives on the
 * /non-academic content routes, not on the redeem form), so an anonymous
 * visitor reaches the form directly — scenario (a) pins that.
 *
 * The authed scenarios drive the trw_redeem_access_code RPC through its
 * three outcomes, using the same seeded-cookie auth as ai-chat-history
 * (sb-<ref>-auth-token cookie from @supabase/ssr createBrowserClient, so
 * getSession() resolves with zero /auth/v1 calls). The RPC responses are
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

function resolveSupabaseRef(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) {
    for (const file of [".env.local", ".env.development", ".env"]) {
      try {
        const raw = readFileSync(path.resolve(process.cwd(), file), "utf8");
        url = raw.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
        if (url) break;
      } catch {
        // file missing — try the next candidate
      }
    }
  }
  if (!url) {
    throw new Error(
      "trw-redeem.spec: NEXT_PUBLIC_SUPABASE_URL not found (env or apps/web/.env.local) — cannot derive the supabase-js localStorage key",
    );
  }
  return new URL(url).hostname.split(".")[0];
}

function buildSeededSession() {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 30;
  const expiresAt = nowSec + expiresIn;
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const accessToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: USER_ID,
    exp: expiresAt,
    aud: "authenticated",
    role: "authenticated",
  })}.mock-signature`;
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "e2e-user@example.com",
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "E2E User" },
      identities: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

async function seedAuthedSession(page: Page, baseURL?: string) {
  // Same cookie shape ai-chat-history.spec.ts seeds: `base64-` + base64url
  // JSON under `sb-<ref>-auth-token` (@supabase/ssr cookieEncoding).
  const storageKey = `sb-${resolveSupabaseRef()}-auth-token`;
  const session = buildSeededSession();
  await page.route("**/auth/v1/token?*", (route) => route.fulfill({ json: session }));
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: session.user }));
  await page.route("**/api/auth/sync", (route) => route.fulfill({ json: { ok: true } }));
  await page.context().addCookies([
    {
      name: storageKey,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: new URL(baseURL ?? "http://localhost:3000").hostname,
      path: "/",
    },
  ]);
}

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
      await seedAuthedSession(page, baseURL);
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
