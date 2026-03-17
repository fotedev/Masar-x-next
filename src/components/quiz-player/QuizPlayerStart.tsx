import React from "react";
import { ArrowRight, Play, Target, Timer } from "lucide-react";

type Quiz = {
  title: string;
  description?: string;
  duration_seconds?: number;
};

export function QuizPlayerStart(props: {
  quiz: Quiz;
  questionsCount: number;
  durationMinutes: number | null;
  onStart: () => void;
  onClose?: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const { quiz, questionsCount, durationMinutes, onStart, onClose, t } = props;

  return (
    <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl p-8 text-center border border-white/20 dark:border-gray-700/30 shadow-2xl animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Play className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>

      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
        {quiz.title}
      </h2>

      {quiz.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
          {(() => {
            try {
              const parsed = JSON.parse(quiz.description);
              return parsed.description || quiz.description;
            } catch {
              return quiz.description;
            }
          })()}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-10 max-w-sm mx-auto">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
          <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {questionsCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("questionsCount")}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
          <Timer className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {durationMinutes
              ? `${durationMinutes} ${t("minutes")}`
              : t("openTime")}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("time")}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={onStart}
          className="flex items-center justify-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all hover:shadow-2xl hover:shadow-blue-500/40 active:scale-95 group"
        >
          <span>{t("startNow")}</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-[-4px] transition-transform" />
        </button>

        <button
          onClick={onClose}
          className="px-8 py-4 text-gray-500 dark:text-gray-400 font-bold hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
