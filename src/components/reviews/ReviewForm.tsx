import React, { useState } from "react";
import { Send } from "lucide-react";
import { StarRatingInput } from "./StarRating";

interface ReviewFormProps {
  onSubmit: (content: string, rating: number) => Promise<void>;
  user: { id: string } | null;
  onCancel?: () => void;
}

export function ReviewForm({ onSubmit, user, onCancel }: ReviewFormProps) {
  const [newReview, setNewReview] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReview.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onSubmit(newReview.trim(), rating);
      setNewReview("");
      setRating(5);
    } catch {
      // error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center mb-10">
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          يجب عليك تسجيل الدخول لتتمكن من إضافة مراجعة
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-12 modern-card p-6 bg-brand-blue/5 dark:bg-brand-blue/10 border-brand-blue/10 rounded-3xl"
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
          className="bg-brand-blue text-white px-6 py-2 rounded-xl hover:bg-brand-sky disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-blue/20 flex items-center gap-2 font-bold"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>نشر المراجعة</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="bg-slate-100 text-slate-600 px-6 py-2 rounded-xl hover:bg-slate-200 transition-all font-bold"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
