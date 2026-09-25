/**
 * News category filter tests (spec 020 C2/T102) — lock the web tabs'
 * semantics: strict type equality per tab, "all" passes everything,
 * and custom-category items only ever surface under "all".
 */
import { describe, expect, it } from "vitest";

import { customCategoryLabel, matchesCategory } from "../news-filter";

describe("matchesCategory", () => {
  it("passes every item under 'all'", () => {
    expect(matchesCategory({ type: "announcement" }, "all")).toBe(true);
    expect(matchesCategory({ type: "custom", custom_category: "رمضان" }, "all")).toBe(true);
    expect(matchesCategory({ type: null }, "all")).toBe(true);
    expect(matchesCategory({}, "all")).toBe(true);
  });

  it("matches fixed types by strict equality (trimmed)", () => {
    expect(matchesCategory({ type: "announcement" }, "announcement")).toBe(true);
    expect(matchesCategory({ type: " update " }, "update")).toBe(true);
    expect(matchesCategory({ type: "important" }, "important")).toBe(true);
  });

  it("never matches a different type", () => {
    expect(matchesCategory({ type: "announcement" }, "update")).toBe(false);
    expect(matchesCategory({ type: "custom" }, "important")).toBe(false);
  });

  it("excludes null/custom types from the fixed tabs", () => {
    expect(matchesCategory({ type: null }, "announcement")).toBe(false);
    expect(matchesCategory({ type: "custom" }, "announcement")).toBe(false);
    expect(matchesCategory({}, "update")).toBe(false);
  });
});

describe("customCategoryLabel", () => {
  it("returns the custom category for custom-typed items", () => {
    expect(
      customCategoryLabel({ type: "custom", custom_category: " exam week " }),
    ).toBe("exam week");
  });

  it("returns null for fixed types and blank labels", () => {
    expect(customCategoryLabel({ type: "announcement", custom_category: "x" })).toBeNull();
    expect(customCategoryLabel({ type: "custom", custom_category: "  " })).toBeNull();
    expect(customCategoryLabel({ type: "custom" })).toBeNull();
  });
});
