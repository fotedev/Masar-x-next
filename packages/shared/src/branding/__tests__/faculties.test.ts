import { afterEach, describe, expect, it, vi } from "vitest";

import { FACULTY_PRESET_IDS, resolveFacultyPresetId, resolveFacultyPresetIdFromEnv } from "../faculties";

// Spec 052 — the faculty white-label resolver is the single switch every
// brand surface reads; a wrong value must degrade to core branding, never
// crash a deployment.

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
