"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/navigation";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { quizService } from "../../../lib/quiz";
import MathDisplay from "../../../components/MathDisplay";
import { confirmToast } from "../../../lib/confirmToast";

type AttemptAnswer = {
  question_id?: string;
  is_correct?: boolean;
  selected_option?: number;
} & Record<string, unknown>;

type AttemptRecord = {
  id?: string;
  quiz_id?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  score?: number;
  total_questions?: number;
  time_taken_seconds?: number;
  is_local?: boolean;
  answers?: AttemptAnswer[];
  quizzes?: { title?: string } | null;
} & Record<string, unknown>;

type QuizQuestionRecord = {
  id?: string;
  question?: string;
  options?: string[];
  correct_answer?: number;
  explanation?: string;
} & Record<string, unknown>;

type AttemptAnswerWithQuestion = AttemptAnswer & {
  question?: QuizQuestionRecord;
};

export default function QuizAttemptsPage() {
  const t = useTranslations("quizAttempts");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const { user } = useAuth();
  const router = useRouter();

  const dateLocale = locale === "en" || locale === "ar" ? locale : "ar";

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedQuizQuestions, setExpandedQuizQuestions] = useState<
    QuizQuestionRecord[] | null
  >(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // 1. Load from DB if user is logged in
        let dbAttempts: AttemptRecord[] = [];
        if (user) {
          try {
            dbAttempts = (await quizService.getUserAttempts(
              user.id,
            )) as AttemptRecord[];
          } catch {
            // ignore
          }
        }

        // 2. Load from localStorage
        let localAttempts: AttemptRecord[] = [];
        try {
          const localData = localStorage.getItem("quiz_history");
          if (localData) {
            localAttempts = JSON.parse(localData) as AttemptRecord[];
          }
        } catch {
          // ignore
        }

        // 3. Merge and deduplicate
        // If an attempt is in both, DB version is usually better (has quiz title etc)
        // But local version might have more details if sync failed.
        // For now, let's just combine them and filter by ID.
        const combined = [...dbAttempts];

        localAttempts.forEach((local) => {
          const exists = combined.some((db) => db.id === local.id);
          if (!exists) {
            combined.push(local);
          }
        });

        // Sort by date descending
        combined.sort((a, b) => {
          const dateA = new Date(String(a.created_at || 0)).getTime();
          const dateB = new Date(String(b.created_at || 0)).getTime();
          return dateB - dateA;
        });

        setAttempts(combined);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  useEffect(() => {
    const fetchQuizQuestions = async () => {
      if (expandedId) {
        const expandedAttempt = attempts.find((a) => a.id === expandedId);
        if (
          expandedAttempt &&
          typeof expandedAttempt.quiz_id === "string" &&
          expandedAttempt.quiz_id
        ) {
          try {
            const { questions } = await quizService.getQuiz(
              expandedAttempt.quiz_id,
            );
            setExpandedQuizQuestions(questions as QuizQuestionRecord[]);
          } catch {
            setExpandedQuizQuestions(null);
          }
        } else {
          setExpandedQuizQuestions(null);
        }
      } else {
        setExpandedQuizQuestions(null);
      }
    };

    fetchQuizQuestions();
  }, [expandedId, attempts]);

  const attemptsWithDerived = useMemo(() => {
    return attempts.map((a) => {
      const startedAt = a.started_at ? new Date(String(a.started_at)) : null;
      const finishedAt = a.finished_at ? new Date(String(a.finished_at)) : null;

      const answersWithQuestions = a.answers?.map((answer) => {
        const question = expandedQuizQuestions?.find((q) =>
          typeof q.id === "string" && typeof answer.question_id === "string"
            ? q.id === answer.question_id
            : false,
        );
        return { ...answer, question } as AttemptAnswer & {
          question?: QuizQuestionRecord;
        };
      });

      return {
        ...a,
        _startedAt: startedAt,
        _finishedAt: finishedAt,
        _answersWithQuestions: answersWithQuestions,
      };
    });
  }, [attempts, expandedQuizQuestions]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-almarai">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {t("pageTitle")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t("pageDescription")}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              confirmToast(t("confirmClearHistory"), {
                confirmLabel: t("clear"),
                cancelLabel: commonT("cancel"),
              }).then((confirmed: boolean) => {
                if (!confirmed) return;
                localStorage.removeItem("quiz_history");
                window.location.reload();
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          >
            {t("clearLocalHistory")}
          </button>
          <button
            onClick={() => router.push("/quizzes")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("back")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : attemptsWithDerived.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="text-gray-700 dark:text-gray-300">
            {t("noAttemptsFound")}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {attemptsWithDerived.map((a) => {
            const isExpanded = expandedId === a.id;
            const title = a.quizzes?.title || t("defaultQuizTitle");
            return (
              <div
                key={a.id || String(a.created_at || "")}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === a.id ? null : (a.id ?? null),
                    )
                  }
                  className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-lg text-gray-900 dark:text-white">
                        {title}
                      </div>
                      {a.is_local && (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full border border-blue-100 dark:border-blue-800">
                          {t("localTag")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString(dateLocale)
                        : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-md font-bold text-gray-800 dark:text-gray-100">
                      {a.score ?? 0}/{a.total_questions ?? 0}
                      {typeof a.time_taken_seconds === "number"
                        ? ` - ${Math.floor(a.time_taken_seconds / 60)}${t("minutesShort")} ${a.time_taken_seconds % 60}${t("secondsShort")}`
                        : ""}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      {t("attemptResultTitle")}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("scoreLabel")}
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                          {a.score ?? 0}/{a.total_questions ?? 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("percentageLabel")}
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                          {(a.total_questions ?? 0) > 0
                            ? `${(((a.score ?? 0) / (a.total_questions ?? 1)) * 100).toFixed(0)}%`
                            : "0%"}
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-4">
                        <div className="text-xs">
                          {t("correctQuestionsLabel")}
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {a.answers?.filter((ans) => ans.is_correct).length ??
                            0}
                        </div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-4">
                        <div className="text-xs">
                          {t("wrongQuestionsLabel")}
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {a.answers?.filter((ans) => !ans.is_correct).length ??
                            0}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("solvedQuestionsLabel")}
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                          {a.answers?.length ?? 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("unsolvedQuestionsLabel")}
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                          {(a.total_questions ?? 0) - (a.answers?.length ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-6">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("startedAtLabel")}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {a._startedAt
                            ? a._startedAt.toLocaleString(dateLocale)
                            : "-"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("timeTakenLabel")}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {typeof a.time_taken_seconds === "number"
                            ? t("timeTakenValue", {
                                minutes: Math.floor(a.time_taken_seconds / 60),
                                seconds: a.time_taken_seconds % 60,
                              })
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                        {t("answersLabel")}
                      </div>
                      <div className="space-y-4">
                        {a._answersWithQuestions?.map(
                          (
                            answer: AttemptAnswerWithQuestion,
                            index: number,
                          ) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg border ${
                                answer.is_correct
                                  ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-700"
                                  : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                {answer.is_correct ? (
                                  <span className="text-green-600 dark:text-green-400">
                                    &#10004;
                                  </span>
                                ) : (
                                  <span className="text-red-600 dark:text-red-400">
                                    &#10006;
                                  </span>
                                )}
                                <span className="text-gray-900 dark:text-white">
                                  {t("questionIndex", { number: index + 1 })}
                                </span>
                              </div>

                              {answer.question?.question && (
                                <MathDisplay latex={answer.question.question} />
                              )}

                              {answer.question?.options?.map(
                                (option: string, optionIndex: number) => (
                                  <div
                                    key={optionIndex}
                                    className={`p-2 rounded-md mb-1 text-sm ${
                                      optionIndex === answer.selected_option
                                        ? answer.is_correct
                                          ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 font-semibold"
                                          : "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 font-semibold"
                                        : optionIndex ===
                                            answer.question?.correct_answer
                                          ? "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100"
                                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optionIndex)}.{" "}
                                    <MathDisplay latex={option} />
                                  </div>
                                ),
                              )}

                              {answer.question?.explanation && (
                                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                                  <span className="font-bold">
                                    {t("explanationLabel")}:
                                  </span>{" "}
                                  <MathDisplay
                                    latex={answer.question.explanation}
                                  />
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
