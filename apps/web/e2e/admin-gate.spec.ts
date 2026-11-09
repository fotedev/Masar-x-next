import { expect, test } from "@playwright/test";

/**
 * Admin dashboard gate (anonymous) — spec 040 Wave 9.
 *
 * The gate is SERVER-side: app/[locale]/admin-dashboard/layout.tsx calls
 * getCachedUser() and redirects("/login") for anonymous visitors (then
 * /unauthorized for non-admin users). An anonymous visitor must therefore
 * land somewhere that is NOT /admin-dashboard, with no application error
 * boundary. The redirect target is /login without a locale prefix, which
 * the proxy locale-rewrites (observed final URL: /ar/login).
 */

const ERROR_BOUNDARY = /Application error|Something went wrong|حدث خطأ|حدث شيء ما|عذراً/;

test("anonymous /ar/admin-dashboard is redirected away without an error boundary", async ({
  page,
}) => {
  // Anonymous browser auth mocks (the layout gate itself runs server-side).
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ json: { id: null, email: null, aud: null } }),
  );
  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({ json: { error: "no_session" } }),
  );

  await page.goto("/ar/admin-dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForURL(
    (url) => !url.pathname.includes("admin-dashboard"),
    { timeout: 45_000 },
  );
  await expect(page.locator("body")).not.toContainText(ERROR_BOUNDARY);
});
