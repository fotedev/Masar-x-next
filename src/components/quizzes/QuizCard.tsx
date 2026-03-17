import React from "react";
import { Trash2, Star } from "lucide-react";
import { QuizWithRatings } from "../../types/database";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface QuizCardProps {
  quiz: QuizWithRatings;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
  t: TranslationFn;
}

export function QuizCard({ quiz, onDelete, onUpdateStatus, t }: QuizCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {quiz.title}
          </h3>
          {quiz.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
              {quiz.description.startsWith("{")
                ? (() => {
                    try {
                      const parsed = JSON.parse(quiz.description!);
                      return parsed.description || quiz.description;
                    } catch {
                      return quiz.description;
                    }
                  })()
                : quiz.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            {quiz.subject && (
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                {quiz.subject}
              </span>
            )}
            {quiz.department && (
              <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
                {quiz.department}
              </span>
            )}
            {quiz.year && (
              <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">
                {quiz.year}
              </span>
            )}
            <span>
              {t("source")}{" "}
              {quiz.source_type === "manual" ? t("manual") : t("ai")}
            </span>
            {(quiz.avg_rating ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-brand-orange">
                <Star className="w-3 h-3 fill-brand-orange" />
                {quiz.avg_rating ?? 0} ({quiz.reviews_count})
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(quiz.status === "pending" || !quiz.status) && (
            <>
              <button
                onClick={() => onUpdateStatus(quiz.id, "approved")}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                {t("approve")}
              </button>
              <button
                onClick={() => onUpdateStatus(quiz.id, "rejected")}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                {t("reject")}
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(quiz.id)}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            {t("delete")}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t("created")}{" "}
          {quiz.created_at
            ? new Date(quiz.created_at).toLocaleDateString()
            : "-"}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full ${
            quiz.status === "approved"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : quiz.status === "rejected"
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}
        >
          {quiz.status === "approved"
            ? t("approved")
            : quiz.status === "rejected"
              ? t("rejected")
              : t("pending")}
        </span>
      </div>
    </div>
  );
}
