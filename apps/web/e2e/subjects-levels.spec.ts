import { expect, test } from "@playwright/test";

/**
 * Subjects profile scoping — owner decision 2026-11-05 (supersedes the
 * spec 034 level tabs): level selection lives in the profile, so /subjects
 * renders no tab bar and the subjects query is scoped server-side to the
 * viewer's profile level (useSubjects default path).
 *
 * Anonymous, route-mocked variant. The signed-in variant (profile level N →
 * level.eq.N) is covered by the useSubjects unit tests — Playwright has no
 * portable seed session yet (same deferral reason as subjects-catalog.spec.ts).
 */

test.describe("subjects profile scoping (no level tabs)", () => {
  test("anonymous visitor: no tab bar, level-1 scoped query with show_on_home", async ({
    page,
  }) => {
    let subjectsUrl = "";
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: { id: null, email: null, aud: null } }),
    );
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({ json: { error: "no_session" } }),
    );
    await page.route("**/rest/v1/subjects*", (route) => {
      subjectsUrl = decodeURIComponent(route.request().url());
      return route.fulfill({ json: [] });
    });
    await page.route("**/rest/v1/profiles*", (route) => route.fulfill({ json: null }));

    await page.goto("/ar/subjects", { waitUntil: "domcontentloaded" });

    // The spec 034 tab bar is gone — level comes from the profile only.
    await expect(page.getByTestId("subjects-level-tabs")).toHaveCount(0);
    await expect(page.getByTestId("subjects-level-tab")).toHaveCount(0);

    // Guest fallback (profile level null → 1) scopes the query, and the
    // anonymous show_on_home filter is preserved.
    await expect.poll(() => subjectsUrl).toContain("level.eq.1");
    await expect.poll(() => subjectsUrl).toContain("show_on_home.eq.true");
  });
});
