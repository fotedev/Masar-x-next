import { describe, expect, it } from "vitest";
import {
  getLectureInfoFromTitle,
  inferLectureKeyFromTitle,
  normalizeText,
  toLatinDigits,
} from "../lecture-inference";

const LECTURES = [
  { id: "l1", lecture_key: "lec-1", lecture_label: "محاضرة 1", order_index: 1 },
  { id: "l2", lecture_key: "lec-2", lecture_label: "محاضرة 2", order_index: 2 },
];

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

describe("getLectureInfoFromTitle", () => {
  it("reads lecture_key from a JSON quiz description first", () => {
    const info = getLectureInfoFromTitle(
      "Quiz 1",
      JSON.stringify({ lecture_key: "lec-2" }),
      LECTURES,
    );
    expect(info).toEqual({ key: "lec-2", label: "محاضرة 2", order: 2 });
  });

  it("falls back to a default label when the key has no saved lecture", () => {
    const info = getLectureInfoFromTitle("Quiz", JSON.stringify({ lecture_key: "lec-9" }), LECTURES);
    expect(info.key).toBe("lec-9");
    expect(info.label).toBe("محاضرة");
    expect(info.order).toBe(999999);
  });

  it("ignores malformed JSON descriptions", () => {
    const info = getLectureInfoFromTitle("محاضرة 1", "{broken json", LECTURES);
    expect(info.key).toBe("lec-1");
  });

  it("classifies an empty title as other/غير مصنف", () => {
    expect(getLectureInfoFromTitle("")).toEqual({
      key: "other",
      label: "غير مصنف",
      order: 999999,
    });
  });

  it("exact-matches a saved lecture label", () => {
    const info = getLectureInfoFromTitle("محاضرة 2", undefined, LECTURES);
    expect(info.key).toBe("lec-2");
    expect(info.order).toBe(2);
  });

  it("prefix-matches a saved lecture label (title has extra text)", () => {
    const info = getLectureInfoFromTitle("محاضرة 1 - الجزء الأول", undefined, LECTURES);
    expect(info.key).toBe("lec-1");
  });

  it("infers محاضرة N from Arabic titles (Arabic-Indic digits included)", () => {
    expect(getLectureInfoFromTitle("محاضرة ٣").key).toBe("lec-3");
    // The label prefix is hardcoded "محاضرة" regardless of the input's spelling.
    expect(getLectureInfoFromTitle("محاضره 5").label).toBe("محاضرة 5");
  });

  it("infers Lecture N / Week 2&3 from English titles", () => {
    expect(getLectureInfoFromTitle("Lecture 7: Heart").key).toBe("lec-7");
    expect(getLectureInfoFromTitle("Week 2 & 3").key).toBe("lec-2-3");
  });

  it("returns other for unmatchable titles", () => {
    expect(getLectureInfoFromTitle("امتحان نهائي").key).toBe("other");
  });
});

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
