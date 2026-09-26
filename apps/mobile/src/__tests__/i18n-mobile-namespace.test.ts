/**
 * Mobile-namespace i18n regression test: bottom-tab labels rendered as
 * raw keys (`tabs.subjects`, …) because `translateMessage(locale,
 * "mobile", key)` built the dot-path `"mobile.tabs.subjects"` and the
 * dot-splitting `lookup()` searched a nonexistent `tree["mobile"]`
 * (MOBILE_STRINGS keys are flat). The "mobile" namespace must resolve
 * flat — one central fix covering every screen + the tab bar.
 */
import { describe, expect, it, vi } from "vitest";

// Hermes/RN defines __DEV__ globally; vitest/node does not — the lookup
// reads it on missing-key paths, so stub it (mirrors a release bundle).
(globalThis as Record<string, unknown>).__DEV__ = false;

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "ar" }],
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

import { translateMessage } from "../i18n";

describe("translateMessage mobile namespace (flat lookup)", () => {
  it("resolves all five tab labels in Arabic (no raw keys)", () => {
    expect(translateMessage("ar", "mobile", "tabs.subjects")).toBe("المواد");
    expect(translateMessage("ar", "mobile", "tabs.quizzes")).toBe("الاختبارات");
    expect(translateMessage("ar", "mobile", "tabs.news")).toBe("الأخبار");
    expect(translateMessage("ar", "mobile", "tabs.ai")).toBe("المساعد الذكي");
    expect(translateMessage("ar", "mobile", "tabs.profile")).toBe("حسابي");
  });

  it("resolves all five tab labels in English", () => {
    expect(translateMessage("en", "mobile", "tabs.subjects")).toBe("Subjects");
    expect(translateMessage("en", "mobile", "tabs.quizzes")).toBe("Quizzes");
    expect(translateMessage("en", "mobile", "tabs.news")).toBe("News");
    expect(translateMessage("en", "mobile", "tabs.ai")).toBe("AI Tutor");
    expect(translateMessage("en", "mobile", "tabs.profile")).toBe("Profile");
  });

  it("still resolves shared-registry namespaces via dot paths", () => {
    expect(translateMessage("ar", "subjects", "title")).toBe("المواد الدراسية");
    expect(translateMessage("en", "subjects", "title")).toBe("Academic Subjects");
  });

  it("falls back to the raw key for unknown mobile keys", () => {
    expect(translateMessage("ar", "mobile", "no.such.key")).toBe("no.such.key");
  });
});
