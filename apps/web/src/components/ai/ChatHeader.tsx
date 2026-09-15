import {
  Bot,
  Brain,
  MessagesSquare,
  Settings,
} from "lucide-react";
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
  onOpenPuterSettings: () => void;
  isPuterSignedIn: boolean;
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
  onOpenPuterSettings,
  isPuterSignedIn,
}: ChatHeaderProps) {
  const modes = [
    { id: "cs_assistant" as AiAssistantMode, icon: Bot, label: t("assistantProgramming") },
    { id: "student_agent" as AiAssistantMode, icon: Brain, label: t("assistantStudent") },
    { id: "group_rag" as AiAssistantMode, icon: MessagesSquare, label: t("assistantGroupChat") },
  ];
  const currentMode = modes.find((m) => m.id === mode) || modes[0];

  return (
    <div className="w-full px-2 sm:px-4 py-1.5 shrink-0 z-20">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2">
        {/* Left: mode icon + label + status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            <currentMode.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white relative z-10" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
              {currentMode.label}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="hidden sm:inline text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap ms-1">
                {t("onlineReady")}
              </span>
            </div>
          </div>
        </div>

        {/* Right: AI settings + student toolset + last-exam chip */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 sm:gap-2 justify-end">
          {/* AI Settings button — mobile icon */}
          <button
            onClick={onOpenPuterSettings}
            className={`p-2 rounded-xl transition-all active:scale-95 text-white shadow-sm md:hidden ${ 
              isPuterSignedIn
                ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/40"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
            title={t("puterMode")}
            aria-label={t("puterMode")}
            type="button"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* AI Settings button — desktop label */}
          <button
            type="button"
            onClick={onOpenPuterSettings}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white hidden md:flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
            title={t("puterMode")}
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t("puterMode")}</span>
          </button>

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
                className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex-1 sm:flex-none min-w-[90px] max-w-[140px] focus:ring-2 focus:ring-cyan-500/20 outline-none focus:text-base transition-all truncate"
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
                className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 flex-1 sm:flex-none min-w-[90px] max-w-[140px] focus:ring-2 focus:ring-cyan-500/20 outline-none focus:text-base transition-all truncate"
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
    </div>
  );
}
