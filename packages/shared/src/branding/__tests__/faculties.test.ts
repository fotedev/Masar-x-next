import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FACULTY_PRESET_IDS, resolveFacultyPresetId, resolveFacultyPresetIdFromEnv } from "../faculties";

// Spec 052 — the faculty white-label resolver is the single switch every
// brand surface reads; a wrong value must degrade to core branding, never
// crash a deployment.

// Spec 055 — prompt strings live in the same `faculty` namespace as the
// marketing strings but under a dedicated key, so the two can drift
// independently (ZANE's voice vs marketing copy).
const here = path.dirname(fileURLToPath(import.meta.url));
const facultyJson = (locale: "ar" | "en") =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(here, "../../messages", locale, "faculty.json"),
      "utf8",
    ),
  ) as Record<string, Record<string, unknown>>;

describe("resolveFacultyPresetId — core fallback", () => {
  it.each([undefined, null, "", "   "])(
    "%p → null (core Masar X branding)",
    (raw) => {
      expect(resolveFacultyPresetId(raw as string | null | undefined)).toBeNull();
    },
  );
});

describe("resolveFacultyPresetId — matching", () => {
  it.each([
    ["fcai-asnu", "exact lowercase id"],
    ["FCAI-ASNU", "uppercase spelling"],
    ["  Fcai-Asnu  ", "trimmed + mixed case"],
    ["bis", "second preset"],
    ["BIS", "uppercase second preset"],
  ])("%s → %s", (raw) => {
    expect(resolveFacultyPresetId(raw)).toBe(raw!.trim().toLowerCase());
  });

  it("every declared preset id round-trips", () => {
    for (const id of FACULTY_PRESET_IDS) {
      expect(resolveFacultyPresetId(id)).toBe(id);
    }
  });
});

describe("resolveFacultyPresetId — unknown value", () => {
  it("returns null and warns in dev (never throws)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(resolveFacultyPresetId("not-a-faculty")).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain("not-a-faculty");
      expect(warn.mock.calls[0]?.[0]).toContain("fcai-asnu");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("resolveFacultyPresetIdFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("unset env var → null (core branding)", () => {
    vi.stubEnv("NEXT_PUBLIC_FACULTY", "");
    expect(resolveFacultyPresetIdFromEnv()).toBeNull();
  });

  it("reads NEXT_PUBLIC_FACULTY case-insensitively", () => {
    vi.stubEnv("NEXT_PUBLIC_FACULTY", "fcai-asnu");
    expect(resolveFacultyPresetIdFromEnv()).toBe("fcai-asnu");
  });

  it("unknown env var → null (falls back to core)", () => {
    vi.stubEnv("NEXT_PUBLIC_FACULTY", "typo-faculty");
    expect(resolveFacultyPresetIdFromEnv()).toBeNull();
  });
});

describe("faculty.json — promptPlatformName shape (spec 055)", () => {
  it.each(["ar", "en"] as const)(
    "%s: every preset has a non-empty string promptPlatformName",
    (locale) => {
      const table = facultyJson(locale);
      for (const id of FACULTY_PRESET_IDS) {
        const value = table[id]?.promptPlatformName;
        expect(value, `${locale}/${id}.promptPlatformName missing`).toEqual(
          expect.any(String),
        );
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("ar and en tables carry the same preset ids", () => {
    expect(Object.keys(facultyJson("ar")).sort()).toEqual(
      Object.keys(facultyJson("en")).sort(),
    );
  });
});
