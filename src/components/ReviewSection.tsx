import React from "react";
import { MessageSquare } from "lucide-react";
import { useReviews } from "../hooks/useReviews";
import { useAuth } from "../contexts/AuthContext";
import { confirmToast } from "../lib/confirmToast";
import { ReviewStats } from "./reviews/ReviewStats";
import { ReviewForm } from "./reviews/ReviewForm";
import { ReviewItem } from "./reviews/ReviewItem";

interface ReviewSectionProps {
  contentId: string;
  contentType?: "summary" | "quiz" | "course" | "video";
}

export function ReviewSection({
  contentId,
  contentType = "summary",
}: ReviewSectionProps) {
  const { user, isAdmin } = useAuth();
  const { reviews, loading, stats, addReview, deleteReview } = useReviews(
    contentId,
    contentType,
  );

  const handleSubmitReview = async (content: string, rating: number) => {
    const reviewData: any = {
      content,
      user_id: user?.id,
      rating,
      summary_id: contentType === "summary" ? contentId : undefined,
      quiz_id: contentType === "quiz" ? contentId : undefined,
      course_id: contentType === "course" ? contentId : undefined,
      video_id: contentType === "video" ? contentId : undefined,
    };

    await addReview(reviewData);
  };

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذه المراجعة؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!confirmed) return;
    try {
      await deleteReview(reviewId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-brand-blue" />
          المراجعات والتقييمات ({reviews.length})
        </h2>
      </div>

      {reviews.length > 0 && <ReviewStats stats={stats} />}

      <ReviewForm onSubmit={handleSubmitReview} user={user} />

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin"></div>
          </div>
        ) : reviews.length > 0 ? (
          reviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              user={user}
              isAdmin={isAdmin}
              onDelete={handleDeleteReview}
            />
          ))
        ) : (
          <div className="text-center py-16 modern-card border-dashed">
            <MessageSquare className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">
              لا توجد مراجعات بعد.
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
              كن أول من يقيم هذا المحتوى!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
