/**
 * Summary reviews (spec 020 C4/T107-T110): data access for the mobile
 * summary-detail screen — detail row from `summaries_with_ratings`,
 * review rows from `review_details`, and the post/delete mutations.
 *
 * Column note: the shared Database type names the review text column
 * `comment`, but the real table column is `content` — the web hook
 * maps it explicitly in useReviews.ts (and the review_details view
 * aliases `content` back to `comment` for reading). buildReviewInsert
 * performs the same mapping here so the mobile insert lands on the
 * real column; the call-site payload keeps the web shape
 * ({ rating, comment, user_id, summary_id }).
 */
import type { SupabaseClient } from "masarx-shared/supabase";
import type { SummaryWithRatings } from "masarx-shared/types";

export type SummaryDetailRow = SummaryWithRatings;

/** Row of the `review_details` view (security_invoker over `reviews`). */
export interface ReviewDetailRow {
  id: string;
  rating: number;
  /** View alias of `reviews.content`. */
  comment: string | null;
  user_id: string | null;
  summary_id: string | null;
  created_at: string;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
}

export async function fetchSummaryDetail(
  supabase: SupabaseClient,
  summaryId: string,
): Promise<SummaryDetailRow | null> {
  const { data, error } = await supabase
    .from("summaries_with_ratings")
    .select("*")
    .eq("id", summaryId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as SummaryDetailRow | null;
}

export async function fetchSummaryReviews(
  supabase: SupabaseClient,
  summaryId: string,
): Promise<ReviewDetailRow[]> {
  const { data, error } = await supabase
    .from("review_details")
    .select("*")
    .eq("summary_id", summaryId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewDetailRow[];
}

export interface ReviewInsertInput {
  rating: number;
  comment: string | null;
  userId: string;
  summaryId: string;
}

export interface ReviewInsertPayload {
  rating: number;
  /** Real table column (the shared type's `comment` is stale). */
  content: string | null;
  user_id: string;
  summary_id: string;
}

/** Integer 1-5 — mirrors the DB CHECK on `reviews.rating`. */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/**
 * Build the `reviews` insert payload. Throws on out-of-range ratings
 * (the star picker only produces 1-5, so this is pure defense); an
 * empty/whitespace comment is allowed and becomes `content: null`.
 */
export function buildReviewInsert(input: ReviewInsertInput): ReviewInsertPayload {
  if (!isValidRating(input.rating)) {
    throw new RangeError(`rating must be an integer 1-5, received ${input.rating}`);
  }
  const trimmed = input.comment?.trim() ?? "";
  return {
    rating: input.rating,
    content: trimmed.length > 0 ? trimmed : null,
    user_id: input.userId,
    summary_id: input.summaryId,
  };
}

export async function insertReview(
  supabase: SupabaseClient,
  payload: ReviewInsertPayload,
): Promise<void> {
  const { error } = await supabase.from("reviews").insert(payload);
  if (error) throw error;
}

/** Delete-own guard: RLS only permits the review's author. */
export function canDeleteReview(
  review: { user_id?: string | null },
  userId?: string | null,
): boolean {
  if (!userId || !review.user_id) return false;
  return review.user_id === userId;
}

export async function deleteReview(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}
