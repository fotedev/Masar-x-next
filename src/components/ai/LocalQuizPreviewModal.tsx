import React from "react";
import { X } from "lucide-react";

type LocalGeneratedQuiz = {
  id?: string;
  localId?: string;
  data?: {
    title?: string;
  };
};

interface LocalQuizPreviewModalProps {
  generatedQuiz: LocalGeneratedQuiz | null;
  safeLocalGeneratedQuizzes: LocalGeneratedQuiz[];
  setGeneratedQuiz: (quiz: LocalGeneratedQuiz | null) => void;
  resetLocalQuizPlayer: () => void;
  onOpenLocalQuiz: () => void;
  onClose: () => void;
  user: { id: string } | null;
  t: (key: string) => string;
}

export function LocalQuizPreviewModal({
  generatedQuiz,
  safeLocalGeneratedQuizzes,
  setGeneratedQuiz,
  resetLocalQuizPlayer,
  onOpenLocalQuiz,
  onClose,
  user,
  t,
}: LocalQuizPreviewModalProps) {
  if (!generatedQuiz) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl modern-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {t("lastGeneratedExam")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            aria-label={t("close")}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          {generatedQuiz?.data && (
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {generatedQuiz.data.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {user ? t("userExamNotice") : t("guestExamNotice")}
              </div>
            </div>
          )}

          {safeLocalGeneratedQuizzes.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                {t("selectExam")}
              </div>
              <select
                value={generatedQuiz?.localId || ""}
                onChange={(e) => {
                  const next = safeLocalGeneratedQuizzes.find(
                    (q) => q.localId === e.target.value,
                  );
                  if (!next) return;
                  setGeneratedQuiz(next);
                  resetLocalQuizPlayer();
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
              >
                {safeLocalGeneratedQuizzes.map((q) => (
                  <option key={q.localId} value={q.localId}>
                    {q.data?.title || t("noTitle")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <button
              onClick={() => {
                onClose();
                onOpenLocalQuiz();
              }}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-all text-sm shadow-lg shadow-indigo-500/20"
            >
              {t("startExam")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
