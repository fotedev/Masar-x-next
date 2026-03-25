import React from "react";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Cloud,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";
import { LatexRenderer } from "../LatexRenderer";

type Question = {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
  image_url?: string;
};

export function QuizPlayerQuestion(props: {
  currentQuestion: Question;
  currentQuestionIndex: number;
  totalQuestions: number;
  selectedOption: number | null;
  isAnswered: boolean;
  score: number;
  saving: boolean;
  attemptError: string | null;
  isGuest: boolean;
  timeLeftSeconds: number | null;
  formatTime: (s: number) => string;
  onSelectOption: (index: number) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const {
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    selectedOption,
    isAnswered,
    score,
    saving,
    attemptError,
    isGuest,
    timeLeftSeconds,
    formatTime,
    onSelectOption,
    onSubmitAnswer,
    onNextQuestion,
    onPreviousQuestion,
    t,
  } = props;

  return (
    <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 relative">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-700 ease-out relative"
          style={{
            width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
          }}
        >
          <div className="absolute top-0 right-0 w-4 h-full bg-white/30 skew-x-12 animate-pulse"></div>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        {attemptError && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-xs font-medium text-red-700 dark:text-red-300">
              {attemptError}
            </p>
          </div>
        )}

        {isGuest && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p 
              dir="auto"
              className="text-xs font-medium text-blue-700 dark:text-blue-300 text-start"
            >
              {t("guestAttemptNotice")}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              {currentQuestionIndex + 1}
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("viewCount", {
                start: currentQuestionIndex + 1,
                end: totalQuestions,
                total: totalQuestions,
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
              {saving ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{t("saving")}</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-green-500" />
                  <span>{t("saved")}</span>
                </>
              )}
            </div>

            {typeof timeLeftSeconds === "number" && (
              <div className="px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm font-black border border-purple-100 dark:border-purple-900/30 flex items-center gap-2">
                <Timer className="w-4 h-4" />
                {formatTime(timeLeftSeconds)}
              </div>
            )}
            <div className="px-4 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm font-black border border-green-100 dark:border-green-900/30">
              {score} {t("points")}
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
          <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-lg relative h-[400px]">
            <Image
              src={currentQuestion.image_url}
              alt="Question illustration"
              fill
              className="object-contain bg-white dark:bg-gray-900/50"
            />
          </div>
        )}

        <div className="space-y-4 mb-10">
          {currentQuestion.options.map((option, index) => {
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
                onClick={() => onSelectOption(index)}
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
              onClick={onPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="group flex items-center gap-2 px-6 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <ArrowRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180 group-hover:rtl:translate-x-[4px] group-hover:ltr:translate-x-[-4px] transition-transform" />
              <span>{t("previous")}</span>
            </button>

            {!isAnswered ? (
              <button
                onClick={onSubmitAnswer}
                disabled={selectedOption === null}
                className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-95"
              >
                {t("confirmAnswer")}
              </button>
            ) : (
              <button
                onClick={onNextQuestion}
                className="group flex items-center gap-3 px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-100 transition-all hover:shadow-xl active:scale-95"
              >
                <span>
                  {currentQuestionIndex === totalQuestions - 1
                    ? t("showResults")
                    : t("nextQuestion")}
                </span>
                <ArrowRight className="w-5 h-5 ltr:rotate-0 rtl:rotate-180 group-hover:ltr:translate-x-[4px] group-hover:rtl:translate-x-[-4px] transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
