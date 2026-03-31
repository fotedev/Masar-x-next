
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

  const descriptionText = (() => {
    if (!quiz.description) return undefined;

    try {
      const parsed: unknown = JSON.parse(quiz.description);
      if (
        parsed &&
        typeof parsed === "object" &&
        "description" in parsed &&
        typeof (parsed as { description?: unknown }).description === "string"
      ) {
        const parsedDescription = (parsed as { description: string }).description.trim();
        return parsedDescription.length > 0 ? parsedDescription : undefined;
      }

      const trimmed = quiz.description.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    } catch {
      const trimmed = quiz.description.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  })();

  return (
    <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl p-8 text-center border border-white/20 dark:border-gray-700/30 shadow-2xl animate-in fade-in zoom-in duration-500 font-sans" dir="rtl">
      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Play className="w-10 h-10 text-blue-600 dark:text-blue-400 rtl:rotate-180" />
      </div>

      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">
        {quiz.title}
      </h2>

      {descriptionText && (
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed text-lg">
          {descriptionText}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-10 max-w-sm mx-auto">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30 transition-colors">
          <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {questionsCount}
          </div>
          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("questionsCountLabel")}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30 transition-colors">
          <Timer className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {durationMinutes
              ? `${durationMinutes} ${t("minutes")}`
              : t("openTime")}
          </div>
          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("timeLabel")}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={onStart}
          className="flex items-center justify-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all hover:shadow-2xl hover:shadow-blue-500/40 active:scale-95 group"
        >
          <span>{t("startNow")}</span>
          <ArrowRight className="w-6 h-6 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
        </button>

        <button
          onClick={onClose}
          className="px-8 py-4 text-gray-500 dark:text-gray-400 font-bold hover:text-gray-700 dark:hover:text-gray-200 transition-colors active:scale-95"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
