import {
  AlertCircle,
  RefreshCw,
  Star,
  Target,
  Timer,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { ReviewSection } from "../ReviewSection";

export function QuizPlayerResults(props: {
  quizId?: string;
  score: number;
  totalQuestions: number;
  endedByTimeout: boolean;
  timeTakenSeconds: number;
  isGuest: boolean;
  onClose?: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  showSubmitForReview?: boolean;
  onSubmitForReview?: () => void | Promise<void>;
  isSubmittingForReview?: boolean;
}) {
  const {
    quizId,
    score,
    totalQuestions,
    endedByTimeout,
    timeTakenSeconds,
    isGuest,
    onClose,
    t,
    showSubmitForReview = false,
    onSubmitForReview,
    isSubmittingForReview = false,
  } = props;

  const percentage = Math.round((score / totalQuestions) * 100);

  let colorClass = "text-blue-600 dark:text-blue-400";
  let bgClass = "bg-blue-50 dark:bg-blue-900/20";
  let iconColor = "text-blue-500";
  let message = t("goodJob");

  if (percentage >= 90) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
    bgClass = "bg-yellow-50 dark:bg-yellow-900/20";
    iconColor = "text-yellow-500";
    message = t("amazing");
  } else if (percentage >= 70) {
    colorClass = "text-green-600 dark:text-green-400";
    bgClass = "bg-green-50 dark:bg-green-900/20";
    iconColor = "text-green-500";
    message = t("excellent");
  }

  return (
    <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl p-8 text-center border border-white/20 dark:border-gray-700/30 shadow-2xl animate-in fade-in zoom-in duration-500">
      <div
        className={`w-24 h-24 ${bgClass} rounded-full flex items-center justify-center mx-auto mb-6 relative`}
      >
        <Trophy className={`w-12 h-12 ${iconColor} relative z-10`} />
        {percentage >= 70 && (
          <div className="absolute inset-0 bg-current opacity-20 rounded-full animate-ping"></div>
        )}
      </div>

      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
        {t("completed")}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium">
        {endedByTimeout ? t("endedTimeout") : message}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
          <Star className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
          <div className={`text-2xl font-bold ${colorClass}`}>
            {percentage}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("score")}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
          <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {score}/{totalQuestions}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("answers")}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
          <Timer className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {timeTakenSeconds}s
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("time")}
          </div>
        </div>
      </div>

      {isGuest && (
        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl flex items-start gap-3 text-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
              {t("guestMode")}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400/80 mt-1">
              {t("guestNotice")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
        >
          <RefreshCw className="w-5 h-5" />
          {t("retry")}
        </button>

        {showSubmitForReview && (
          <button
            onClick={onSubmitForReview}
            disabled={!onSubmitForReview || isSubmittingForReview}
            className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 ${
              !onSubmitForReview || isSubmittingForReview
                ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30"
            }`}
          >
            {isSubmittingForReview ? (
              <>
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                جاري الإرسال
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                إرسال للمراجعة
              </>
            )}
          </button>
        )}

        <button
          onClick={onClose}
          className="px-8 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
        >
          {t("backToHome")}
        </button>
      </div>

      <div className="mt-10 text-start">
        {quizId && <ReviewSection contentId={quizId} contentType="quiz" />}
      </div>
    </div>
  );
}
