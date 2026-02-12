import React, { useState } from "react";
import Image from "next/image";
import { Send, User, Trash2, MessageSquare, Star } from "lucide-react";
import { useReviews } from "../hooks/useReviews";
import { useAuth } from "../contexts/AuthContext";

interface ReviewSectionProps {
  contentId: string;
  contentType?: "summary" | "quiz" | "course";
}

const StarRatingInput = ({
  rating,
  setRating,
}: {
  rating: number;
  setRating: (r: number) => void;
}) => {
  return (
    <div className="flex items-center gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setRating(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              star <= rating
                ? "fill-brand-orange text-brand-orange"
                : "text-slate-300 dark:text-slate-700"
            }`}
          />
        </button>
      ))}
      <span className="mr-3 text-sm font-bold text-slate-600 dark:text-slate-400">
        {rating} من 5
      </span>
    </div>
  );
};

const StarDisplay = ({
  rating,
  size = "w-4 h-4",
}: {
  rating: number;
  size?: string;
}) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating
              ? "fill-brand-orange text-brand-orange"
              : "text-slate-200 dark:text-slate-800"
          }`}
        />
      ))}
    </div>
  );
};

export function ReviewSection({
  contentId,
  contentType = "summary",
}: ReviewSectionProps) {
  const { user, isAdmin } = useAuth();
  const { reviews, loading, stats, addReview, deleteReview } = useReviews(
    contentId,
    contentType,
  );
  const [newReview, setNewReview] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReview.trim() || submitting) return;

    try {
      setSubmitting(true);
      const reviewData = {
        content: newReview.trim(),
        user_id: user.id,
        rating: rating,
        summary_id: contentType === "summary" ? contentId : undefined,
        quiz_id: contentType === "quiz" ? contentId : undefined,
        course_id: contentType === "course" ? contentId : undefined,
      };

      await addReview(reviewData);
      setNewReview("");
      setRating(5);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه المراجعة؟")) return;
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

      {/* Rating Summary Section */}
      {reviews.length > 0 && (
        <div className="modern-card p-6 mb-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Average Rating */}
            <div className="text-center md:border-l border-slate-100 dark:border-slate-800">
              <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                {stats.average}
              </div>
              <div className="flex justify-center mb-2">
                <StarDisplay
                  rating={Math.round(stats.average)}
                  size="w-5 h-5"
                />
              </div>
              <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                بناءً على {stats.total} تقييم
              </div>
            </div>

            {/* Distribution Bars */}
            <div className="md:col-span-2 space-y-2">
              {stats.distribution.map((data) => (
                <div key={data.rating} className="flex items-center gap-4">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {data.rating}
                    </span>
                    <Star className="w-3 h-3 fill-slate-400 text-slate-400" />
                  </div>
                  <div className="flex-grow h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-orange rounded-full transition-all duration-1000"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-left">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {data.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Review Form */}
      {user ? (
        <form
          onSubmit={handleSubmit}
          className="mb-12 modern-card p-6 bg-brand-blue/5 dark:bg-brand-blue/10 border-brand-blue/10"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            أضف مراجعتك
          </h3>
          <StarRatingInput rating={rating} setRating={setRating} />
          <div className="relative">
            <textarea
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              placeholder="شاركنا رأيك..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all resize-none min-h-[120px] text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!newReview.trim() || submitting}
              className="absolute bottom-4 left-4 bg-brand-blue text-white px-6 py-2 rounded-xl hover:bg-brand-sky disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-blue/20 flex items-center gap-2 font-bold"
            >
              <span>نشر المراجعة</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center mb-10">
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            يجب عليك تسجيل الدخول لتتمكن من إضافة مراجعة
          </p>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin"></div>
          </div>
        ) : reviews.length > 0 ? (
          reviews.map((review) => (
            <div
              key={review.id}
              className="group flex gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 hover:border-brand-blue/30 transition-all hover:shadow-xl hover:shadow-brand-blue/5"
            >
              <div className="flex-shrink-0">
                {review.avatar_url ? (
                  <div className="w-12 h-12 relative">
                    <Image
                      src={review.avatar_url}
                      alt={review.full_name || "User"}
                      fill
                      className="rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-brand-blue" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {review.full_name || review.username || "مستخدم"}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <StarDisplay rating={review.rating || 5} size="w-3 h-3" />
                      <span className="text-[11px] text-slate-400 font-bold">
                        {review.created_at &&
                          new Date(review.created_at).toLocaleDateString(
                            "ar-EG",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                      </span>
                    </div>
                  </div>
                  {(isAdmin || (user && user.id === review.user_id)) && (
                    <button
                      onClick={() => review.id && handleDelete(review.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      title="حذف المراجعة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                  {review.content}
                </p>
              </div>
            </div>
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
