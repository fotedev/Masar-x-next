import { useMemo } from "react";
import { XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { useQuizAttempt } from "../hooks/useQuizAttempt";
import { useTranslations } from "next-intl";
import { useQuizPlayerData } from "../hooks/useQuizPlayerData";
import { useQuizPlayerRuntime } from "../hooks/useQuizPlayerRuntime";
import { QuizPlayerResults } from "./quiz-player/QuizPlayerResults";
import { QuizPlayerStart } from "./quiz-player/QuizPlayerStart";
import { QuizPlayerQuestion } from "./quiz-player/QuizPlayerQuestion";

interface QuizPlayerProps {
  quizId?: string;
  quizData?: {
    title: string;
    description?: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
    }>;
  };
  onComplete?: (score: number) => void;
  onClose?: () => void;
}

export function QuizPlayer({
  quizId,
  quizData,
  onComplete,
  onClose,
}: QuizPlayerProps) {
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const t = useTranslations("quiz");

  const { loading, quiz, questions, loadQuiz } = useQuizPlayerData({
    quizId,
    quizData,
    trackEvent,
  });

  // Hook state
  const {
    answers: savedAnswers,
    saving,
    saveAnswer,
    finishAttempt: saveFinishAttempt,
    startTime: attemptStartTime,
    isGuest,
    error: attemptError,
  } = useQuizAttempt({
    quizId: quizId ?? "local",
    userId: user?.id || "guest",
    totalQuestions: questions.length,
    quizTitle: quiz?.title || "Quiz",
  });

  const score = useMemo(
    () => Object.values(savedAnswers).filter((a) => a.is_correct).length,
    [savedAnswers],
  );

  const runtime = useQuizPlayerRuntime({
    quizId,
    quiz,
    questions,
    savedAnswers,
    attemptStartTime,
    score,
    saveAnswer,
    saveFinishAttempt,
    trackEvent,
    onComplete,
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 animate-pulse font-medium">
          {t("preparing")}
        </p>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="text-center p-12 bg-red-50 dark:bg-red-900/10 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-800">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
          {t("failed")}
        </h3>
        <p className="text-red-600/70 dark:text-red-400/70 mb-6">
          {t("failedDesc")}
        </p>
        <button
          onClick={loadQuiz}
          className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all active:scale-95"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  if (runtime.showResults) {
    const timeTaken =
      typeof runtime.timeTakenSeconds === "number"
        ? runtime.timeTakenSeconds
        : attemptStartTime
          ? Math.round((Date.now() - (attemptStartTime || 0)) / 1000)
          : 0;

    return (
      <QuizPlayerResults
        quizId={quizId}
        score={score}
        totalQuestions={questions.length}
        endedByTimeout={runtime.endedByTimeout}
        timeTakenSeconds={timeTaken}
        isGuest={isGuest}
        onClose={onClose}
        t={t}
      />
    );
  }

  if (!runtime.hasStarted) {
    return (
      <QuizPlayerStart
        quiz={quiz}
        questionsCount={questions.length}
        durationMinutes={runtime.durationMinutes}
        onStart={runtime.startQuiz}
        onClose={onClose}
        t={t}
      />
    );
  }

  if (!runtime.currentQuestion) return null;

  return (
    <QuizPlayerQuestion
      currentQuestion={runtime.currentQuestion}
      currentQuestionIndex={runtime.currentQuestionIndex}
      totalQuestions={questions.length}
      selectedOption={runtime.selectedOption}
      isAnswered={runtime.isAnswered}
      score={score}
      saving={saving}
      attemptError={attemptError}
      isGuest={isGuest}
      timeLeftSeconds={runtime.timeLeftSeconds}
      formatTime={runtime.formatTime}
      onSelectOption={runtime.handleOptionSelect}
      onSubmitAnswer={runtime.handleSubmitAnswer}
      onNextQuestion={runtime.handleNextQuestion}
      onPreviousQuestion={runtime.handlePreviousQuestion}
      t={t}
    />
  );
}
