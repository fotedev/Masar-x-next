import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Trophy,
  Star,
  Timer,
  Target,
} from "lucide-react";
import { quizService } from "../lib/quiz";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { LatexRenderer } from "./LatexRenderer";

interface QuizPlayerProps {
  quizId: string;
  onComplete?: (score: number) => void;
  onClose?: () => void;
}

export function QuizPlayer({ quizId, onComplete, onClose }: QuizPlayerProps) {
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState<number | null>(null);
  const [endedByTimeout, setEndedByTimeout] = useState(false);
  const endTimeMsRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const formatTime = (totalSeconds: number) => {
    const s = Math.max(0, totalSeconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const { quiz, questions } = await quizService.getQuiz(quizId);
      setQuiz(quiz);
      setQuestions(questions);
      const now = Date.now();
      setStartTime(now);
      setTimeTakenSeconds(null);
      setEndedByTimeout(false);
      finishingRef.current = false;

      const durationSeconds = typeof quiz?.duration_seconds === "number" ? quiz.duration_seconds : null;
      if (durationSeconds && durationSeconds > 0) {
        endTimeMsRef.current = now + durationSeconds * 1000;
        setTimeLeftSeconds(durationSeconds);
      } else {
        endTimeMsRef.current = null;
        setTimeLeftSeconds(null);
      }

      trackEvent("quiz_started", { quiz_id: quizId, title: quiz.title });
    } catch (error) {
      console.error("Error loading quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showResults) return;
    if (!endTimeMsRef.current) return;

    const interval = window.setInterval(() => {
      if (!endTimeMsRef.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((endTimeMsRef.current - Date.now()) / 1000)
      );
      setTimeLeftSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        finishQuiz(true);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, showResults]);

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedOption === currentQuestion.correct_answer;

    setIsAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);

    setAnswers((prev) => [
      ...prev,
      {
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
      },
    ]);

    trackEvent("question_answered", {
      quiz_id: quizId,
      question_index: currentQuestionIndex,
      is_correct: isCorrect,
    });
  };

  const updateQuestionState = (index: number) => {
    const existingAnswer = answers[index];
    if (existingAnswer) {
      setSelectedOption(existingAnswer.selected_option);
      setIsAnswered(true);
    } else {
      setSelectedOption(null);
      setIsAnswered(false);
    }
    setCurrentQuestionIndex(index);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      updateQuestionState(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      updateQuestionState(currentQuestionIndex - 1);
    }
  };

  const finishQuiz = async (timeout = false) => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    if (timeout) setEndedByTimeout(true);

    const finishedAtMs = Date.now();
    const startedAtMs = startTime ?? finishedAtMs;
    const startedAtIso = new Date(startedAtMs).toISOString();
    const finishedAtIso = new Date(finishedAtMs).toISOString();
    const takenSeconds = Math.max(0, Math.round((finishedAtMs - startedAtMs) / 1000));

    setTimeTakenSeconds(takenSeconds);
    setShowResults(true);

    if (user) {
      try {
        await quizService.submitAttempt(
          quizId,
          user.id,
          score,
          questions.length,
          answers,
          startedAtIso,
          finishedAtIso,
          takenSeconds
        );
      } catch (error: any) {
        const message = typeof error?.message === "string" ? error.message : "";
        const code = error?.code;
        const details = error?.details;
        const hint = error?.hint;
        console.error("Failed to persist quiz attempt:", {
          message,
          code,
          details,
          hint,
        });
      }
    }

    trackEvent("quiz_completed", {
      quiz_id: quizId,
      score: score,
      total: questions.length,
      ended_by_timeout: timeout,
    });

    if (onComplete) onComplete(score);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 animate-pulse font-medium">
          جاري تحضير الاختبار...
        </p>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="text-center p-12 bg-red-50 dark:bg-red-900/10 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-800">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
          فشل تحميل الاختبار
        </h3>
        <p className="text-red-600/70 dark:text-red-400/70 mb-6">
          نعتذر، حدث خطأ أثناء محاولة جلب بيانات الاختبار.
        </p>
        <button
          onClick={loadQuiz}
          className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all active:scale-95"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (showResults) {
    const percentage = Math.round((score / questions.length) * 100);
    const timeTaken = typeof timeTakenSeconds === "number"
      ? timeTakenSeconds
      : startTime
        ? Math.round((Date.now() - startTime) / 1000)
        : 0;

    let colorClass = "text-blue-600 dark:text-blue-400";
    let bgClass = "bg-blue-50 dark:bg-blue-900/20";
    let iconColor = "text-blue-500";
    let message = "عمل جيد! استمر في المحاولة.";

    if (percentage >= 90) {
      colorClass = "text-yellow-600 dark:text-yellow-400";
      bgClass = "bg-yellow-50 dark:bg-yellow-900/20";
      iconColor = "text-yellow-500";
      message = "مذهل! أنت عبقري!";
    } else if (percentage >= 70) {
      colorClass = "text-green-600 dark:text-green-400";
      bgClass = "bg-green-50 dark:bg-green-900/20";
      iconColor = "text-green-500";
      message = "رائع! أداء متميز جداً.";
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
          اكتمل التحدي!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium">
          {endedByTimeout ? "انتهى وقت الامتحان." : message}
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
            <div className={`text-2xl font-bold ${colorClass}`}>
              {percentage}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              النتيجة
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
            <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {score}/{questions.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              الإجابات
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/30">
            <Timer className="w-5 h-5 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {timeTaken}s
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              الوقت
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => {
              setCurrentQuestionIndex(0);
              setScore(0);
              setAnswers([]);
              setShowResults(false);
              setIsAnswered(false);
              setSelectedOption(null);
            }}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
            إعادة المحاولة
          </button>
          <button
            onClick={onClose}
            className="px-8 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Progress Bar */}
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 relative">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-700 ease-out relative"
          style={{
            width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
          }}
        >
          <div className="absolute top-0 right-0 w-4 h-full bg-white/30 skew-x-12 animate-pulse"></div>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              {currentQuestionIndex + 1}
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              من {questions.length} أسئلة
            </span>
          </div>
          <div className="flex items-center gap-3">
            {typeof timeLeftSeconds === "number" && (
              <div className="px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm font-black border border-purple-100 dark:border-purple-900/30 flex items-center gap-2">
                <Timer className="w-4 h-4" />
                {formatTime(timeLeftSeconds)}
              </div>
            )}
            <div className="px-4 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-black border border-green-100 dark:border-green-900/30">
              {score} نقاط
            </div>
          </div>
        </div>

        <h3
          dir="auto"
          className="text-2xl font-bold text-gray-900 dark:text-white mb-10 leading-relaxed text-start"
        >
          <LatexRenderer text={currentQuestion.question} />
        </h3>

        {currentQuestion.image_url && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-lg">
            <img
              src={currentQuestion.image_url}
              alt="Question illustration"
              className="w-full h-auto max-h-[400px] object-contain bg-white dark:bg-gray-900/50"
            />
          </div>
        )}

        <div className="space-y-4 mb-10">
          {currentQuestion.options.map((option: string, index: number) => {
            let optionClass =
              "w-full text-start p-5 rounded-2xl border-2 transition-all duration-300 relative group ";

            if (isAnswered) {
              if (index === currentQuestion.correct_answer) {
                optionClass +=
                  "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 shadow-lg shadow-green-500/10";
              } else if (index === selectedOption) {
                optionClass +=
                  "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 shadow-lg shadow-red-500/10";
              } else {
                optionClass +=
                  "border-gray-100 dark:border-gray-700/50 opacity-40 grayscale-[0.5]";
              }
            } else {
              if (selectedOption === index) {
                optionClass +=
                  "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-lg shadow-blue-500/10 ring-4 ring-blue-500/10";
              } else {
                optionClass +=
                  "border-gray-100 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300 hover:translate-x-[-4px]";
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={isAnswered}
                dir="auto"
                className={optionClass}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold transition-colors ${
                        selectedOption === index
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-200 dark:border-gray-600 text-gray-400"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="font-semibold text-lg">
                      <LatexRenderer text={option} />
                    </span>
                  </div>
                  <div className="flex items-center">
                    {isAnswered && index === currentQuestion.correct_answer && (
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}
                    {isAnswered &&
                      index === selectedOption &&
                      index !== currentQuestion.correct_answer && (
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center animate-in zoom-in duration-300">
                          <XCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-6 pt-6 border-t border-gray-100 dark:border-gray-700/50">
          {isAnswered && currentQuestion.explanation && (
            <div className="animate-in fade-in duration-500 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-base text-gray-700 dark:text-gray-300 font-medium">
              <span className="text-lg">💡</span>
              <div className="flex-1">
                <LatexRenderer text={currentQuestion.explanation} />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="group flex items-center gap-2 px-6 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <ArrowRight className="w-5 h-5 rotate-180 group-hover:translate-x-[4px] transition-transform" />
              <span>السابق</span>
            </button>

            {!isAnswered ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedOption === null}
                className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-95"
              >
                تأكيد الإجابة
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="group flex items-center gap-3 px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-100 transition-all hover:shadow-xl active:scale-95"
              >
                <span>
                  {currentQuestionIndex === questions.length - 1
                    ? "عرض النتائج"
                    : "السؤال التالي"}
                </span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-[-4px] transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
