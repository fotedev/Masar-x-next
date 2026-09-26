/**
 * Theme tests (spec 020 C3/T106).
 *
 * The FIRST suite is the light-palette invariance lock the owner asked
 * for: every lightColors token asserts the exact hex that was hardcoded
 * in the screens before spec 020, so a daytime regression is a test
 * failure, not a surprise. Dark must carry the same key set.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

import {
  darkColors,
  lightColors,
  loadThemeOverride,
  resolveTheme,
  saveThemeOverride,
  type Palette,
} from "../theme";

describe("light-palette invariance (pre-020 hardcoded values)", () => {
  const previousHardcoded: Palette = {
    // Union of every local COLORS const before the migration (App,
    // Subjects/SubjectDetail/Summaries/QuizAttempts/Quizzes/QuizPlay/
    // Login/SignUp/Profile/AIAssistant/News).
    primary: "#4F46E5",
    onPrimary: "#FFFFFF", // button text / active chip text
    ink: "#111827",
    subtle: "#6B7280",
    bg: "#F8FAFC",
    card: "#FFFFFF",
    border: "#E2E8F0",
    inputBorder: "#CBD5E1", // Login/SignUp inputs
    banner: "#FEF3C7",
    bannerText: "#92400E",
    danger: "#DC2626",
    dangerBg: "#FEF2F2", // timer chip / wrong-answer surface
    success: "#16A34A",
    successBg: "#F0FDF4", // correct-answer surface
    accentBg: "#EEF2FF", // inactive chips, toggles, local chips
    accentText: "#4F46E5",
    placeholder: "#94A3B8", // AI input placeholder
  };

  it("matches every previous hardcoded hex byte-for-byte", () => {
    expect(lightColors).toEqual(previousHardcoded);
  });

  it("keeps accentText equal to primary in light mode (as before)", () => {
    expect(lightColors.accentText).toBe(lightColors.primary);
  });
});

describe("palette parity", () => {
  it("dark carries the exact same token keys as light", () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
  });

  it("dark actually differs from light (it is a real palette)", () => {
    expect(darkColors).not.toEqual(lightColors);
    expect(darkColors.bg).not.toBe(lightColors.bg);
  });
});

describe("resolveTheme", () => {
  it("follows the OS scheme in system mode", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", null)).toBe("light");
    expect(resolveTheme("system", undefined)).toBe("light");
  });

  it("explicit modes win over the OS scheme", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
  });
});

describe("override persistence", () => {
  beforeEach(() => {
    store.clear();
  });

  it("round-trips the mode", async () => {
    await saveThemeOverride("dark");
    await expect(loadThemeOverride()).resolves.toBe("dark");
    await saveThemeOverride("system");
    await expect(loadThemeOverride()).resolves.toBe("system");
  });

  it("returns null when nothing is stored", async () => {
    await expect(loadThemeOverride()).resolves.toBeNull();
  });

  it("ignores corrupted values", async () => {
    store.set("masarx_theme_override", "blueberry");
    await expect(loadThemeOverride()).resolves.toBeNull();
  });
});
