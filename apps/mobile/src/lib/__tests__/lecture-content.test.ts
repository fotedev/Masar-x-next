/**
 * Lecture-content matcher tests (spec 019 C2/T078) — lock the ported
 * web semantics: lecture_id wins, trimmed key equality second, rows
 * without a key never key-match, unmatched rows are never dropped.
 */
import { describe, expect, it } from "vitest";

import {
  groupContentByLecture,
  matchesLecture,
  resolveLectureKey,
  type LectureRef,
  type MatchableRow,
} from "../lecture-content";

const lectureA: LectureRef = { id: "lec-a", lecture_key: "ch1", lecture_label: "Lecture 1" };
const lectureB: LectureRef = { id: "lec-b", lecture_key: " ch2 ", lecture_label: "Lecture 2" };
const lectureOther: LectureRef = { id: "lec-o", lecture_key: "", lecture_label: "Misc" };
const lectures = [lectureA, lectureB, lectureOther];

describe("resolveLectureKey", () => {
  it("trims the key", () => {
    expect(resolveLectureKey(lectureB)).toBe("ch2");
  });

  it("falls back to 'other' for an empty key", () => {
    expect(resolveLectureKey(lectureOther)).toBe("other");
  });
});

describe("matchesLecture", () => {
  const row = (over: Partial<MatchableRow>): MatchableRow => ({
    id: "r1",
    title: "Row",
    ...over,
  });

  it("matches by lecture_id first, even when the key disagrees", () => {
    expect(
      matchesLecture(row({ lecture_id: "lec-a", lecture_key: "ch2" }), lectureA),
    ).toBe(true);
  });

  it("matches by trimmed key when ids differ", () => {
    expect(matchesLecture(row({ lecture_key: " ch1 " }), lectureA)).toBe(true);
    expect(matchesLecture(row({ lecture_key: "ch2" }), lectureB)).toBe(true);
  });

  it("never key-matches a row without a key (web line-90 guard)", () => {
    // Even when the lecture resolves to "other", a keyless row does not
    // key-match — it belongs to the unclassified group.
    expect(matchesLecture(row({ lecture_key: null }), lectureOther)).toBe(false);
    expect(matchesLecture(row({}), lectureOther)).toBe(false);
  });

  it("matches an explicit 'other' key row to the empty-key lecture", () => {
    expect(matchesLecture(row({ lecture_key: "other" }), lectureOther)).toBe(true);
  });

  it("rejects non-matching keys", () => {
    expect(matchesLecture(row({ lecture_key: "ch9" }), lectureA)).toBe(false);
  });
});

describe("groupContentByLecture", () => {
  const base = { id: "x", title: "t" };

  it("routes rows of every kind and never drops unmatched content", () => {
    const grouped = groupContentByLecture(
      lectures,
      {
        summaries: [{ ...base, lecture_id: "lec-a" }],
        videos: [{ ...base, lecture_key: "ch2" }],
        files: [{ ...base, lecture_key: "ch9" }],
        quizzes: [{ ...base }],
      },
    );
    expect(grouped.byLectureId["lec-a"].summaries).toHaveLength(1);
    expect(grouped.byLectureId["lec-b"].videos).toHaveLength(1);
    expect(grouped.unclassified.files).toHaveLength(1);
    expect(grouped.unclassified.quizzes).toHaveLength(1);
  });

  it("assigns a row to the FIRST matching lecture when both rules hit different lectures", () => {
    const grouped = groupContentByLecture(
      [lectureA, lectureB],
      { summaries: [], videos: [], files: [], quizzes: [{ ...base, lecture_id: "lec-b", lecture_key: "ch1" }] },
    );
    expect(grouped.byLectureId["lec-b"].quizzes).toHaveLength(1);
    expect(grouped.byLectureId["lec-a"].quizzes).toHaveLength(0);
  });

  it("puts everything in unclassified when the subject has no lectures", () => {
    const grouped = groupContentByLecture(
      [],
      {
        summaries: [{ ...base, lecture_key: "ch1" }],
        videos: [],
        files: [],
        quizzes: [],
      },
    );
    expect(grouped.unclassified.summaries).toHaveLength(1);
  });
});
