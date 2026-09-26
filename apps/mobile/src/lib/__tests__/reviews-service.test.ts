import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/mocks/supabase";
import {
  buildReviewInsert,
  canDeleteReview,
  deleteReview,
  fetchSummaryDetail,
  fetchSummaryReviews,
  insertReview,
  isValidRating,
} from "../reviews";

describe("isValidRating", () => {
  it("accepts integers 1-5 only", () => {
    for (const r of [1, 2, 3, 4, 5]) expect(isValidRating(r)).toBe(true);
    for (const r of [0, 6, -1, 2.5, NaN]) expect(isValidRating(r as number)).toBe(false);
  });
});

describe("buildReviewInsert", () => {
  it("maps the web call-site shape onto the real `content` column", () => {
    const payload = buildReviewInsert({
      rating: 4,
      comment: "شرح ممتاز",
      userId: "u1",
      summaryId: "s1",
    });
    // The shared type names the column `comment`; the real table is `content`.
    expect(payload).toEqual({
      rating: 4,
      content: "شرح ممتاز",
      user_id: "u1",
      summary_id: "s1",
    });
    expect(payload).not.toHaveProperty("comment");
  });

  it("turns empty/whitespace comments into content:null", () => {
    expect(buildReviewInsert({ rating: 5, comment: "   ", userId: "u", summaryId: "s" }).content).toBeNull();
    expect(buildReviewInsert({ rating: 5, comment: null, userId: "u", summaryId: "s" }).content).toBeNull();
  });

  it("throws RangeError on out-of-range ratings", () => {
    expect(() => buildReviewInsert({ rating: 0, comment: null, userId: "u", summaryId: "s" })).toThrow(RangeError);
    expect(() => buildReviewInsert({ rating: 6, comment: null, userId: "u", summaryId: "s" })).toThrow(RangeError);
  });
});

describe("data access", () => {
  it("fetchSummaryDetail reads summaries_with_ratings by id", async () => {
    const chain = createSupabaseMock();
    chain.respondWith({ data: { id: "s1", rating: 4.5 }, error: null });
    const row = await fetchSummaryDetail(chain.supabase as never, "s1");
    expect(row).toEqual({ id: "s1", rating: 4.5 });
    expect(chain.calls[0].table).toBe("summaries_with_ratings");
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual(["id", "s1"]);
  });

  it("fetchSummaryReviews orders review_details newest-first", async () => {
    const chain = createSupabaseMock();
    chain.respondWith({ data: [{ id: "r1" }], error: null }, { table: "review_details" });
    const rows = await fetchSummaryReviews(chain.supabase as never, "s1");
    expect(rows).toEqual([{ id: "r1" }]);
    expect(chain.calls.find((c) => c.method === "order")!.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("insertReview writes the payload as-is and propagates errors", async () => {
    const chain = createSupabaseMock();
    const payload = buildReviewInsert({ rating: 3, comment: "ok", userId: "u1", summaryId: "s1" });
    await insertReview(chain.supabase as never, payload);
    expect(chain.calls.find((c) => c.method === "insert")!.args[0]).toEqual(payload);

    const failing = createSupabaseMock({ data: null, error: { message: "rls" } });
    await expect(
      insertReview(failing.supabase as never, payload),
    ).rejects.toThrow(/rls/);
  });

  it("canDeleteReview enforces delete-own only", () => {
    expect(canDeleteReview({ user_id: "u1" }, "u1")).toBe(true);
    expect(canDeleteReview({ user_id: "u1" }, "u2")).toBe(false);
    expect(canDeleteReview({ user_id: null }, "u1")).toBe(false);
    expect(canDeleteReview({ user_id: "u1" }, null)).toBe(false);
  });

  it("deleteReview removes by id", async () => {
    const chain = createSupabaseMock();
    await deleteReview(chain.supabase as never, "r-9");
    expect(chain.calls.find((c) => c.method === "delete")).toBeDefined();
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual(["id", "r-9"]);
  });
});
