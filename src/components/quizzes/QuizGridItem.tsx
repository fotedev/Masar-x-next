
import { Play, BookOpen, Edit, Trash2, Clock, Layout } from "lucide-react";
import { Quiz } from "@/types/database";

interface QuizGridItemProps {
  quiz: Quiz & { questions?: unknown[] };
  meta: {
    subject: string;
    department: string;
    year: string;
    semester: string;
    descriptionText: string;
  };
  isAdmin: boolean;
  t: (key: string) => string;
  onPlay: (quiz: Quiz) => void;
  onEdit: (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
  onViewSummary: (summaryId: string) => void;
}

export function QuizGridItem({
  quiz,
  meta,
  isAdmin,
  t,
  onPlay,
  onEdit,
  onDelete,
  onViewSummary,
}: QuizGridItemProps) {
  const durationMinutes = quiz.duration_seconds
    ? Math.round(quiz.duration_seconds / 60)
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
              {quiz.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {meta.subject && (
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md">
                  {meta.subject}
                </span>
              )}
              {meta.year && (
                <span className="px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-md">
                  {meta.year}
                </span>
              )}
              {meta.semester && (
                <span className="px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-md">
                  {t("semester")} {meta.semester}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(quiz)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                title={t("edit")}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(quiz)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title={t("delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-2">
          {meta.descriptionText || t("noDescription")}
        </p>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <div className="flex items-center gap-1.5">
            <Layout className="w-4 h-4" />
            <span>
              {Array.isArray(quiz.questions) ? quiz.questions.length : 0}{" "}
              {t("questions")}
            </span>
          </div>
          {durationMinutes && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>
                {durationMinutes} {t("minutes")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-50 dark:border-gray-700">
          <button
            onClick={() => onPlay(quiz)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Play className="w-4 h-4" />
            {t("startExam")}
          </button>
          {quiz.summary_id && (
            <button
              onClick={() => onViewSummary(quiz.summary_id!)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium border border-gray-200 dark:border-gray-600"
              title={t("viewSummary")}
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
