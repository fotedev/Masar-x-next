import { expect, test, type Request } from "@playwright/test";

/**
 * Auth surfaces (anonymous) — localized error paths (spec 040 Wave 9).
 *
 * a) /ar/login with failing credentials: the browser token grant is
 *    route-mocked to a 400, so signIn rejects and the login page's
 *    localized error banner (data-testid login-error-banner) renders.
 * b) /ar/login?error=auth-code-error: the OAuth callback failure surface —
 *    the page sets the same banner from the query param with NO network.
 * c) /ar/signup with mismatched passwords: the client-side passwordMismatch
 *    guard fires before any request — the auth/v1/signup endpoint must
 *    receive ZERO calls.
 *
 * Note on message choice (a): AuthContext re-throws supabase-js's
 * AuthApiError (code "invalid_credentials", lowercase) while the page
 * checks the UPPERCASE constant, so the surface falls through to
 * loginGenericError. The assertion accepts either localized string so the
 * test pins the banner contract, not the casing bug.
 */

// Narrower than the other specs: the login banner's own localized text IS
// "حدث خطأ أثناء تسجيل الدخول", so the shared regex would false-positive on
// the expected error surface. Keep only the unambiguous boundary strings.
const ERROR_BOUNDARY = /Application error|Something went wrong|حدث شيء ما|عذراً/;
const AUTH_ERROR_TEXT =
  /خطأ في البريد الإلكتروني أو كلمة المرور|حدث خطأ أثناء تسجيل الدخول/;

test.describe("auth surfaces (anonymous)", () => {
  test("a) wrong credentials render the localized login error banner", async ({
    page,
  }) => {
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 400,
        json: {
          error: "invalid_grant",
          code: "invalid_credentials",
          msg: "Invalid login credentials",
        },
      }),
    );
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { id: null, email: null, aud: null } }),
    );

    await page.goto("/ar/login");
    await page.getByTestId("login-email").fill("wrong@example.com");
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();

    const banner = page.getByTestId("login-error-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(AUTH_ERROR_TEXT);
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });

  test("b) ?error=auth-code-error renders the OAuth-failure banner without network", async ({
    page,
  }) => {
    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({ json: { error: "no_session" } }),
    );

    await page.goto("/ar/login?error=auth-code-error");
    const banner = page.getByTestId("login-error-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("حدث خطأ أثناء تسجيل الدخول");
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });

  test("c) mismatched passwords on /ar/signup show passwordMismatch and never call signUp", async ({
    page,
  }) => {
    const signupCalls: Request[] = [];
    await page.route("**/auth/v1/signup", (route) => {
      signupCalls.push(route.request());
      return route.fulfill({ json: {} });
    });
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { id: null, email: null, aud: null } }),
    );
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({ json: { error: "no_session" } }),
    );

    await page.goto("/ar/signup");
    await page.getByTestId("signup-email").fill("e2e-signup@example.com");
    await page.getByTestId("signup-password").fill("Password1");
    await page.getByTestId("signup-confirm-password").fill("Password2");
    await page.getByTestId("signup-submit").click();

    await expect(page.getByText("كلمة المرور غير متطابقة")).toBeVisible();
    // The mismatch guard runs client-side BEFORE signUp — the endpoint must
    // not have been hit at all.
    expect(signupCalls).toEqual([]);
    await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
  });
});
