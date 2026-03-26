import React, { useState } from "react";
import { Bot, Brain, Trash2, MessagesSquare, ChevronDown, Check, BookOpen, MessageSquareCode, Users } from "lucide-react";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import { motion, AnimatePresence } from "framer-motion";

type StudentSubjectOption = { id: string; name: string };
type StudentQuizOption = { id: string; title: string };
type LocalGeneratedQuiz = { data?: { title?: string } };

interface ChatHeaderProps {
  mode: AiAssistantMode;
  setMode: (mode: AiAssistantMode) => void;
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
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export function ChatHeader({
  mode,
  setMode,
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
  selectedModel,
  setSelectedModel,
}: ChatHeaderProps) {
  const [isDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const modes = [
    { id: "cs_assistant", icon: Bot, label: t("assistantProgramming") },
    { id: "student_agent", icon: Brain, label: t("assistantStudent") },
    { id: "group_rag", icon: MessagesSquare, label: t("assistantGroupChat") },
  ];

  const models = [
    { id: "gpt-5-nano", label: "GPT-5 nano", provider: "OpenAI" },
    { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
    { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { id: "o1-mini", label: "o1-mini", provider: "OpenAI" },
  ];

  const currentMode = modes.find((m) => m.id === mode) || modes[0];
  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  const getSummaryConfig = () => {
    switch (mode) {
      case "student_agent":
        return {
          icon: BookOpen,
          title: "تلخيص المواد الأكاديمية",
        };
      case "cs_assistant":
        return {
          icon: MessageSquareCode,
          title: "تلخيص المحادثة البرمجية الحالية",
        };
      case "group_rag":
      default:
        return {
          icon: Users,
          title: "تلخيص محادثات المجموعة (الواتساب)",
        };
    }
  };

  const summaryConfig = getSummaryConfig();
  const SummaryIcon = summaryConfig.icon;

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-b-3xl sm:rounded-3xl p-3 sm:p-5 mb-2 sm:mb-4 border-b sm:border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row items-center justify-between shrink-0 z-20 sticky top-[72px] sm:top-0 gap-3">
      <div className="flex items-center justify-between w-full sm:w-auto gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            <currentMode.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white relative z-10" />
          </div>
          <div className="flex flex-col">
            <div className="relative">
              <button
                onClick={() => setIsMobileDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors group py-1"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white">
                  {currentMode.label}
                </span>
                <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""} text-cyan-500`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsMobileDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-40"
                    >
                      <div className="p-2 space-y-1">
                        {modes.map((m) => {
                          const Icon = m.icon;
                          const isActive = mode === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setMode(m.id as AiAssistantMode);
                                setIsMobileDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all ${
                                isActive
                                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="w-6 h-6" />
                                <span className="font-bold text-sm sm:text-base">{m.label}</span>
                              </div>
                              {isActive && <Check className="w-5 h-5" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 mr-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                  {mode === "group_rag"
                    ? t("assistantGroupChat")
                    : mode === "student_agent"
                      ? t("responseFromPlatform")
                      : t("generalCsAssistant")}
                </span>
              </div>
              
              <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-1"></div>
              
              <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="text-[11px] sm:text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:opacity-80 flex items-center gap-1 transition-all py-1.5 px-2 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-lg border border-cyan-500/10"
                >
                  {currentModel.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isModelDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsModelDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-40 p-1.5"
                      >
                        {models.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m.id);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                              selectedModel === m.id
                                ? "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                          >
                            <span className="font-bold text-sm">{m.label}</span>
                            {selectedModel === m.id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header Actions (Clear/Summarize) */}
        <div className="flex items-center gap-3 sm:hidden">
          <button
            onClick={onSummarizeChat}
            disabled={isSummarizing || !hasChatData}
            className={`p-3 rounded-xl transition-all border ${
              isSummarizing || !hasChatData
                ? "text-slate-300 border-slate-100 dark:border-slate-800"
                : "text-slate-400 border-slate-200/50 dark:border-slate-700/50 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-700"
            }`}
            title={summaryConfig.title}
          >
            {isSummarizing ? (
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <SummaryIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onClearChat}
            className="p-3 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200/50 dark:border-slate-700/50"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
        {mode === "student_agent" && (
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <select
              value={studentSelectedSubject}
              onChange={(e) => setStudentSelectedSubject(e.target.value)}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex-1 sm:flex-none min-w-[100px] focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
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
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 flex-1 sm:flex-none min-w-[100px] focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
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
              className="px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-lg sm:rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 shadow-lg shadow-cyan-600/20 transition-all active:scale-95 whitespace-nowrap"
            >
              {t("start")}
            </button>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-1 sm:gap-2">
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>

          <button
            onClick={onSummarizeChat}
            disabled={isSummarizing || !hasChatData}
            className={`p-2 rounded-xl transition-all ${
              isSummarizing || !hasChatData
                ? "text-slate-300"
                : "text-slate-400 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-700"
            }`}
            title={summaryConfig.title}
          >
            {isSummarizing ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <SummaryIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
          <button
            onClick={onClearChat}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
            title="مسح المحادثة"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {generatedQuiz?.data && (
          <div className="flex items-center">
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            <button
              onClick={onShowGeneratedQuizModal}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all text-[10px] sm:text-sm font-bold whitespace-nowrap"
              title={`آخر اختبار مولّد: ${generatedQuiz.data.title}`}
            >
              آخر اختبار
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
