import type { AiAssistantMode } from "@/lib/ai-assistant";
import type { useTranslations } from "next-intl";

type StudentSubjectOption = { id: string; name: string };
type StudentQuizOption = { id: string; title: string };
type LocalGeneratedQuiz = { data?: { title?: string } };

interface ChatHeaderProps {
  mode: AiAssistantMode;
  studentSelectedSubject: string;
  setStudentSelectedSubject: (subject: string) => void;
  studentSubjects: StudentSubjectOption[];
  studentSelectedQuizId: string;
  setStudentSelectedQuizId: (id: string) => void;
  studentQuizzes: StudentQuizOption[];
  studentQuizzesLoading: boolean;
  onStartQuiz: () => void;
  generatedQuiz: LocalGeneratedQuiz | null;
  onShowGeneratedQuizModal: () => void;
  safeLocalGeneratedQuizzesCount: number;
  t: ReturnType<typeof useTranslations<"aiAssistant">>;
}

export function ChatHeader({
  mode,
  studentSelectedSubject,
  setStudentSelectedSubject,
  studentSubjects,
  studentSelectedQuizId,
  setStudentSelectedQuizId,
  studentQuizzes,
  studentQuizzesLoading,
  onStartQuiz,
  generatedQuiz,
  onShowGeneratedQuizModal,
  safeLocalGeneratedQuizzesCount,
  t,
}: ChatHeaderProps) {
  // Spec 012: mode identity (icon + label + status) moved into the composer
  // controls row as a compact chip — this bar renders ONLY when it carries
  // real controls (student toolset / last-exam chip), reclaiming its vertical
  // space in the chat modes.
  if (mode !== "student_agent" && !generatedQuiz?.data) return null;

  return (
    <div className="w-full px-2 sm:px-4 py-1.5 shrink-0 z-20">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-end gap-2">
        {/* Student toolset — only in student_agent mode */}
          {mode === "student_agent" && (
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none flex-1 sm:flex-none">
              <label htmlFor="chat-student-subject" className="sr-only">
                {t("selectSubject")}
              </label>
              <select
                id="chat-student-subject"
                name="chatStudentSubject"
                value={studentSelectedSubject}
                onChange={(e) => setStudentSelectedSubject(e.target.value)}
                className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex-1 sm:flex-none min-w-[90px] max-w-[140px] focus:ring-2 focus:ring-cyan-500/20 outline-none transition-colors truncate"
              >
                <option value="">{t("selectSubject")}</option>
                {studentSubjects?.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <label htmlFor="chat-student-quiz" className="sr-only">
                {t("selectExam")}
              </label>
              <select
                id="chat-student-quiz"
                name="chatStudentQuiz"
                value={studentSelectedQuizId}
                onChange={(e) => setStudentSelectedQuizId(e.target.value)}
                disabled={
                  !studentSelectedSubject ||
                  studentQuizzesLoading ||
                  studentQuizzes.length === 0
                }
                className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 flex-1 sm:flex-none min-w-[90px] max-w-[140px] focus:ring-2 focus:ring-cyan-500/20 outline-none transition-colors truncate"
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
                className="px-3 py-1.5 text-[11px] sm:text-xs font-black rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 shadow-md shadow-cyan-600/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
                type="button"
              >
                {t("start")}
              </button>
            </div>
          )}

          {/* Last-exam chip */}
          {generatedQuiz?.data && (
            <div className="flex items-center">
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
              <button
                onClick={onShowGeneratedQuizModal}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-[11px] sm:text-xs font-bold whitespace-nowrap"
                title={t("lastGeneratedQuizTooltip", { title: generatedQuiz.data.title ?? "" })}
                type="button"
              >
                {t("lastExam")}
                {safeLocalGeneratedQuizzesCount > 1
                  ? ` (${safeLocalGeneratedQuizzesCount})`
                  : ""}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
