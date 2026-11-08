import { describe, expect, it } from "vitest";
import {
  inferLectureKeyFromTitle,
  normalizeText,
  toLatinDigits,
} from "../lecture-inference";

describe("toLatinDigits / normalizeText", () => {
  it("converts Arabic-Indic digits to Latin", () => {
    expect(toLatinDigits("٣")).toBe("3");
    expect(toLatinDigits("محاضرة ١٢")).toContain("12");
    expect(toLatinDigits("")).toBe("");
  });

  it("normalizes whitespace and case", () => {
    expect(normalizeText("  Hello   World ")).toBe("hello world");
    expect(normalizeText("")).toBe("");
  });
});

// getLectureInfoFromTitle and its suite were removed with the function
// itself (spec 041): it had zero importers — the subjects page builds its
// own LectureInfo lambda and useLectureContent only uses
// inferLectureKeyFromTitle.

describe("inferLectureKeyFromTitle", () => {
  const INDEX = [
    { id: "l1", title: "محاضرة 1", lecture_key: "lec-1" },
    { id: "l2", title: "The Cardiac Cycle", lecture_key: "lec-cc" },
  ];

  it("exact-matches key or label case-insensitively", () => {
    expect(inferLectureKeyFromTitle("lec-1", INDEX)).toBe("lec-1");
    expect(inferLectureKeyFromTitle("the cardiac cycle", INDEX)).toBe("lec-cc");
  });

  it("prefix-matches keys", () => {
    expect(inferLectureKeyFromTitle("lec-1 extra", INDEX)).toBe("lec-1");
  });

  it("matches delimiter-separated parts", () => {
    expect(inferLectureKeyFromTitle("Quiz: Cardiac Cycle", INDEX)).toBe("lec-cc");
  });

  it("falls back to substring matching", () => {
    expect(inferLectureKeyFromTitle("Notes on The Cardiac Cycle chapter", INDEX)).toBe("lec-cc");
  });

  it("returns 'other' for empty titles and null when nothing matches", () => {
    expect(inferLectureKeyFromTitle("", INDEX)).toBe("other");
    expect(inferLectureKeyFromTitle("zzz nothing like this", INDEX)).toBeNull();
  });
});
