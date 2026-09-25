/**
 * Quiz timer math tests (spec 019 C6/T098). The AppState foreground
 * re-check reuses computeRemainingSeconds/isTimeExpired with a fresh
 * Date.now(), so locking these pure functions locks the backgrounding
 * behavior: a deadline passed while backgrounded resolves exactly once
 * on the next evaluation.
 */
import { describe, expect, it } from "vitest";

import {
  computeRemainingSeconds,
  computeTimeTakenSeconds,
  isTimeExpired,
  splitTime,
} from "../quiz-timer";

describe("computeRemainingSeconds", () => {
  it("counts down from the absolute end time", () => {
    expect(computeRemainingSeconds(10_000 + 65_400, 10_000)).toBe(66);
  });

  it("ceils partial seconds", () => {
    expect(computeRemainingSeconds(10_000 + 1_500, 10_000)).toBe(2);
  });

  it("clamps at 0 in the past", () => {
    expect(computeRemainingSeconds(10_000, 99_999)).toBe(0);
  });
});

describe("isTimeExpired", () => {
  it("is false while time remains", () => {
    expect(isTimeExpired(20_000, 10_000)).toBe(false);
  });

  it("is true at the boundary and beyond", () => {
    expect(isTimeExpired(20_000, 20_000)).toBe(true);
    expect(isTimeExpired(20_000, 20_001)).toBe(true);
  });
});

describe("splitTime", () => {
  it("splits minutes and seconds", () => {
    expect(splitTime(75)).toEqual({ minutes: 1, seconds: 15 });
    expect(splitTime(600)).toEqual({ minutes: 10, seconds: 0 });
    expect(splitTime(0)).toEqual({ minutes: 0, seconds: 0 });
  });

  it("clamps negatives to zero", () => {
    expect(splitTime(-5)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("computeTimeTakenSeconds", () => {
  it("rounds elapsed wall-clock time", () => {
    expect(computeTimeTakenSeconds(1_000, 61_400)).toBe(60);
  });

  it("never goes negative", () => {
    expect(computeTimeTakenSeconds(5_000, 1_000)).toBe(0);
  });
});
