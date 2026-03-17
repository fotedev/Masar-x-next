import React from "react";
import { Bot, Brain, Trash2 } from "lucide-react";
import type { AiAssistantMode } from "@/lib/ai-assistant";

type StudentSubjectOption = { id: string; name: string };
type StudentQuizOption = { id: string; title: string };
type LocalGeneratedQuiz = { data?: { title?: string } };

interface ChatHeaderProps {
  mode: AiAssistantMode;
  toggleMode: () => void;
  studentSelectedSubject: string;
  setStudentSelectedSubject: (subject: string) => void;
  studentSubjects: StudentSubjectOption[];
  studentSelectedQuizId: string;
  setStudentSelectedQuizId: (id: string) => void;
  studentQuizzes: StudentQuizOption[];
  studentQuizzesLoading: boolean;
  onStartQuiz: () => void;
  onSummarizeChat: () => void;
  onClearChat: () => void;
  isSummarizing: boolean;
  hasChatData: boolean;
  generatedQuiz: LocalGeneratedQuiz | null;
  onShowGeneratedQuizModal: () => void;
  safeLocalGeneratedQuizzesCount: number;
  t: (key: string) => string;
}

export function ChatHeader({
  mode,
  toggleMode,
  studentSelectedSubject,
  setStudentSelectedSubject,
  studentSubjects,
  studentSelectedQuizId,
  setStudentSelectedQuizId,
  studentQuizzes,
  studentQuizzesLoading,
  onStartQuiz,
  onSummarizeChat,
  onClearChat,
  isSummarizing,
  hasChatData,
  generatedQuiz,
  onShowGeneratedQuizModal,
  safeLocalGeneratedQuizzesCount,
  t,
}: ChatHeaderProps) {
  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl p-4 sm:p-5 mb-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === "group_rag"
              ? t("assistantGroupChat")
              : mode === "student_agent"
                ? t("assistantStudent")
                : t("smartAssistant")}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {mode === "group_rag"
                ? t("assistantGroupChat")
                : mode === "student_agent"
                  ? t("responseFromPlatform")
                  : t("generalCsAssistant")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={toggleMode}
          className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 hover:shadow-sm"
          title={
            mode === "group_rag"
              ? t("switchCsAssistant")
              : mode === "cs_assistant"
                ? t("switchStudentAssistant")
                : t("switchGroupChat")
          }
        >
          <span className="sm:hidden flex items-center justify-center">
            <Brain className="w-4 h-4" />
          </span>
          <span className="hidden sm:inline">
            {t("switchLabel")}
            {mode === "group_rag"
              ? t("assistantProgramming")
              : mode === "cs_assistant"
                ? t("assistantStudent")
                : t("assistantGroupChat")}
          </span>
        </button>

        {mode === "student_agent" && (
          <div className="flex items-center gap-2 px-2">
            <select
              value={studentSelectedSubject}
              onChange={(e) => setStudentSelectedSubject(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="">{t("selectSubject")}</option>
              {studentSubjects?.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={studentSelectedQuizId}
              onChange={(e) => setStudentSelectedQuizId(e.target.value)}
              disabled={
                !studentSelectedSubject ||
                studentQuizzesLoading ||
                studentQuizzes.length === 0
              }
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60"
            >
              <option value="">
                {studentQuizzesLoading
                  ? t("loadingExams")
                  : studentQuizzes.length === 0
                    ? t("noExams")
                    : t("selectExam")}
              </option>
              {studentQuizzes.map((qz) => (
                <option key={qz.id} value={qz.id}>
                  {qz.title}
                </option>
              ))}
            </select>

            <button
              onClick={onStartQuiz}
              disabled={!studentSelectedQuizId}
              className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              title={t("startExam")}
            >
              {t("start")}
            </button>
          </div>
        )}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

        <button
          onClick={onSummarizeChat}
          disabled={isSummarizing || !hasChatData}
          className={`p-2 rounded-xl transition-all ${
            isSummarizing || !hasChatData
              ? "text-slate-300"
              : "text-slate-400 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-700"
          }`}
          title="تلخيص المحادثة (آخر 100 رسالة)"
        >
          {isSummarizing ? (
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
        <button
          onClick={onClearChat}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
          title="مسح المحادثة"
        >
          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {generatedQuiz?.data && (
          <>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            <button
              onClick={onShowGeneratedQuizModal}
              className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all text-sm font-bold"
              title={`آخر اختبار مولّد: ${generatedQuiz.data.title}`}
            >
              آخر اختبار
              {safeLocalGeneratedQuizzesCount > 1
                ? ` (${safeLocalGeneratedQuizzesCount})`
                : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
