/**
 * Review insert validation + delete-own guard tests (spec 020 C4/T110).
 *
 * Locks the payload contract of lib/reviews: rating bounds mirror the
 * DB CHECK on `reviews.rating` (integer 1-5), an empty/whitespace
 * comment is allowed and becomes `content: null` (the real table
 * column — the shared type's `comment` is stale, web maps it the same
 * way in useReviews.ts), and only the review's author may delete.
 */
import { describe, expect, it } from "vitest";

import {
  buildReviewInsert,
  canDeleteReview,
  isValidRating,
} from "../reviews";

describe("buildReviewInsert", () => {
  const base = { userId: "user-1", summaryId: "summary-1" };

  it("maps comment onto the real `content` column and keeps the web payload shape", () => {
    expect(buildReviewInsert({ ...base, rating: 4, comment: "مفيد جداً" })).toEqual({
      rating: 4,
      content: "مفيد جداً",
      user_id: "user-1",
      summary_id: "summary-1",
    });
  });

  it("trims surrounding whitespace from the comment", () => {
    expect(buildReviewInsert({ ...base, rating: 5, comment: "  good  " }).content).toBe("good");
  });

  it("allows an empty comment (content null)", () => {
    expect(buildReviewInsert({ ...base, rating: 3, comment: "" }).content).toBeNull();
  });

  it("allows a null comment and a whitespace-only comment (content null)", () => {
    expect(buildReviewInsert({ ...base, rating: 3, comment: null }).content).toBeNull();
    expect(buildReviewInsert({ ...base, rating: 3, comment: "   " }).content).toBeNull();
  });

  it("rejects out-of-range ratings (0 and 6)", () => {
    expect(() => buildReviewInsert({ ...base, rating: 0, comment: null })).toThrow(RangeError);
    expect(() => buildReviewInsert({ ...base, rating: 6, comment: null })).toThrow(RangeError);
  });

  it("rejects non-integer ratings", () => {
    expect(() => buildReviewInsert({ ...base, rating: 4.5, comment: null })).toThrow(RangeError);
  });

  it("accepts the full 1-5 range", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(buildReviewInsert({ ...base, rating, comment: null }).rating).toBe(rating);
    }
  });
});

describe("isValidRating", () => {
  it("accepts integers 1-5 only", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(2.5)).toBe(false);
    expect(isValidRating(Number.NaN)).toBe(false);
  });
});

describe("canDeleteReview", () => {
  const review = (userId?: string | null) => ({ user_id: userId });

  it("allows the author to delete their own review", () => {
    expect(canDeleteReview(review("user-1"), "user-1")).toBe(true);
  });

  it("denies deleting another user's review", () => {
    expect(canDeleteReview(review("user-2"), "user-1")).toBe(false);
  });

  it("denies when there is no signed-in user", () => {
    expect(canDeleteReview(review("user-1"), null)).toBe(false);
    expect(canDeleteReview(review("user-1"), undefined)).toBe(false);
  });

  it("denies rows with no author (defensive)", () => {
    expect(canDeleteReview(review(null), "user-1")).toBe(false);
  });
});
