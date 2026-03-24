import React from "react";
import Image from "next/image";
import { User, Trash2 } from "lucide-react";
import { StarDisplay } from "./StarRating";
import type { ReviewDetails } from "@/types/database";

type ReviewLike = ReviewDetails & { content?: string | null };

interface ReviewItemProps {
  review: ReviewLike;
  user: { id: string } | null;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}

export function ReviewItem({
  review,
  user,
  isAdmin,
  onDelete,
}: ReviewItemProps) {
  return (
    <div className="group flex gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 hover:border-brand-blue/30 transition-all hover:shadow-xl hover:shadow-brand-blue/5">
      <div className="flex-shrink-0">
        {review.reviewer_avatar ? (
          <div className="w-12 h-12 relative">
            <Image
              src={review.reviewer_avatar}
              alt={review.reviewer_name || "User"}
              fill
              sizes="48px"
              className="rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
              unoptimized
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
              {review.reviewer_name || "مستخدم"}
            </h4>
            <div className="flex items-center gap-3 mt-1">
              <StarDisplay rating={review.rating || 5} size="w-3 h-3" />
              <span className="text-[11px] text-slate-400 font-bold">
                {review.created_at &&
                  new Date(review.created_at).toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
              </span>
            </div>
          </div>
          {(isAdmin || (user && user.id === review.user_id)) && (
            <button
              onClick={() => review.id && onDelete(review.id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              title="حذف المراجعة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
          {review.content || review.comment || ""}
        </p>
      </div>
    </div>
  );
}
