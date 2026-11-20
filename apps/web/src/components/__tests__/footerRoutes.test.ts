import { describe, expect, it } from "vitest";

import { FOOTER_ROUTES, isFooterRoute } from "../footer/footerRoutes";

// Footer route scope (owner decision 2026-11-20): the footer renders ONLY on
// info/utility routes; studying pages — and any unlisted route — must stay
// footer-free by default, so the classification is locked down by tests.

describe("isFooterRoute — info/utility routes keep the footer", () => {
  it.each([...FOOTER_ROUTES])("%s renders the footer", (path) => {
    expect(isFooterRoute(path)).toBe(true);
  });
});

describe("isFooterRoute — studying routes are footer-free", () => {
  it.each([
    // studying hubs + players
    "/subjects",
    "/subjects/oop",
    "/subjects/oop/lectures/lec-1",
    "/summaries/summary-1",
    "/quizzes",
    "/quiz-play/quiz-1",
    "/quiz-attempts",
    "/schedules",
    "/materials",
    "/courses",
    "/courses/course-1",
    "/non-academic",
    "/non-academic/trading",
    "/trw",
    "/trw/money-making",
    "/trw/money-making/some-course",
  ])("%s does not render the footer", (path) => {
    expect(isFooterRoute(path)).toBe(false);
  });
});

describe("isFooterRoute — gated surfaces must not regress", () => {
  it.each([
    "/ai-assistant",
    "/ai-assistant/settings",
    "/admin",
    "/admin-dashboard",
    "/admin-dashboard/news",
    // unknown routes (404) default to footer-free
    "/some-junk-route",
  ])("%s does not render the footer", (path) => {
    expect(isFooterRoute(path)).toBe(false);
  });
});

describe("isFooterRoute — edge inputs", () => {
  it("treats null and undefined as footer-free", () => {
    expect(isFooterRoute(null)).toBe(false);
    expect(isFooterRoute(undefined)).toBe(false);
  });

  it("matches exactly — no prefix or trailing-slash matches", () => {
    expect(isFooterRoute("/faq/extra")).toBe(false);
    expect(isFooterRoute("/downloads-old")).toBe(false);
    expect(isFooterRoute("/faq/")).toBe(false);
  });
});
