import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { ReviewDetails, ReviewInsert } from "../types/database";

export function useReviews(contentId: string, contentType: "summary" | "quiz" | "course" | "video" = "summary") {
    const [reviews, setReviews] = useState<ReviewDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isDev = process.env.NODE_ENV !== "production";

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            const query = supabase
                .from("review_details")
                .select("*");

            if (contentType === "summary") {
                query.eq("summary_id", contentId);
            } else if (contentType === "quiz") {
                query.eq("quiz_id", contentId);
            } else if (contentType === "course") {
                query.eq("course_id", contentId);
            } else if (contentType === "video") {
                query.eq("video_id", contentId);
            }

            const { data, error } = await query.order("created_at", { ascending: false });

            if (error) throw error;
            setReviews(data || []);
        } catch {
            setError("حدث خطأ أثناء تحميل المراجعات");
        } finally {
            setLoading(false);
        }
    }, [contentId, contentType]);

    const addReview = async (review: ReviewInsert) => {
        try {
            if (isDev) {
                console.debug("[reviews] insert payload", {
                    contentType,
                    contentId,
                    review,
                });
            }
            const { error } = await supabase
                .from("reviews")
                .insert(review);

            if (error) {
                if (isDev) {
                    console.error("[reviews] insert error", {
                        code: (error as any).code,
                        message: (error as any).message,
                        details: (error as any).details,
                        hint: (error as any).hint,
                        error,
                    });
                }
                throw error;
            }
            await fetchReviews();
        } catch (error) {
            throw error;
        }
    };

    const deleteReview = async (reviewId: string) => {
        try {
            const { error } = await supabase
                .from("reviews")
                .delete()
                .eq("id", reviewId);

            if (error) {
                if (isDev) {
                    console.error("[reviews] delete error", {
                        reviewId,
                        code: (error as any).code,
                        message: (error as any).message,
                        details: (error as any).details,
                        hint: (error as any).hint,
                        error,
                    });
                }
                throw error;
            }
            setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        } catch (error) {
            throw error;
        }
    };

    const stats = useMemo(() => {
        if (reviews.length === 0) {
            return {
                average: 0,
                total: 0,
                distribution: [
                    { rating: 5, count: 0, percentage: 0 },
                    { rating: 4, count: 0, percentage: 0 },
                    { rating: 3, count: 0, percentage: 0 },
                    { rating: 2, count: 0, percentage: 0 },
                    { rating: 1, count: 0, percentage: 0 },
                ]
            };
        }

        const total = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        const average = Number((sum / total).toFixed(1));

        const counts = [0, 0, 0, 0, 0, 0]; // index 1-5
        reviews.forEach(r => {
            if (r.rating) counts[r.rating]++;
        });

        const distribution = [5, 4, 3, 2, 1].map(r => ({
            rating: r,
            count: counts[r],
            percentage: Math.round((counts[r] / total) * 100)
        }));

        return { average, total, distribution };
    }, [reviews]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    return {
        reviews,
        loading,
        error,
        stats,
        addReview,
        deleteReview,
        refreshReviews: fetchReviews,
    };
}


