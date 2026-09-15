import { useState, useEffect, useCallback } from "react";
import type { KeyboardEvent, RefObject } from "react";
import {
  Send,
  Plus,
  Check,
  ChevronDown,
  Bot,
  Brain,
  MessagesSquare,
  Trash2,
  BookOpen,
  MessageSquareCode,
  Users,
} from "lucide-react";
import { getTextDirection } from "@/utils/textDirection";

import { motion, AnimatePresence } from "framer-motion";
import { QuickQuizFromTextModal } from "@/components/ai/QuickQuizFromTextModal";
import { QuickQuizPlayerModal } from "@/components/ai/QuickQuizPlayerModal";
import { useLocale } from "next-intl";
import type { AiAssistantMode } from "@/lib/ai/assistant";

type LocalQuizData = {
  title: string;
  description?: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
};

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  t: (key: string) => string;
  isInitialState?: boolean;
  user?: { id: string } | null;
  mode: AiAssistantMode;
  setMode: (mode: AiAssistantMode) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onSummarizeChat: () => void;
  onClearChat: () => void;
  isSummarizing: boolean;
  hasChatData: boolean;
}

const modes = [
  { id: "cs_assistant" as AiAssistantMode, icon: Bot, labelKey: "assistantProgramming" },
  { id: "student_agent" as AiAssistantMode, icon: Brain, labelKey: "assistantStudent" },
  { id: "group_rag" as AiAssistantMode, icon: MessagesSquare, labelKey: "assistantGroupChat" },
];

const models = [
  { id: "gpt-5-nano", label: "GPT-5 nano", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "claude-sonnet-4-6", label: "Claude 4.6 Sonnet", provider: "Anthropic" },
  { id: "o1-mini", label: "o1-mini", provider: "OpenAI" },
];

export function ChatInput({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  inputRef,
  t,
  isInitialState = false,
  user = null,
  mode,
  setMode,
  selectedModel,
  setSelectedModel,
  onSummarizeChat,
  onClearChat,
  isSummarizing,
  hasChatData,
}: Omit<ChatInputProps, "suggestions" | "onSuggestionClick">) {
  const [isMobile, setIsMobile] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [isQuickQuizOpen, setIsQuickQuizOpen] = useState(false);
  const [isQuickQuizPlayerOpen, setIsQuickQuizPlayerOpen] = useState(false);
  const [quickQuizData, setQuickQuizData] = useState<LocalQuizData | null>(null);
  const [quickQuizSourceText, setQuickQuizSourceText] = useState("");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  const getSummaryConfig = () => {
    switch (mode) {
      case "student_agent":
        return { icon: BookOpen, title: t("summarizeAcademicSubjects") };
      case "cs_assistant":
        return { icon: MessageSquareCode, title: t("summarizeCsChat") };
      case "group_rag":
      default:
        return { icon: Users, title: t("summarizeGroupChat") };
    }
  };

  const summaryConfig = getSummaryConfig();
  const SummaryIcon = summaryConfig.icon;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px is Tailwind's 'sm' breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Escape key dismissal for both menus
  useEffect(() => {
    if (!isToolsOpen && !isModelOpen) return;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsToolsOpen(false);
        setIsModelOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isToolsOpen, isModelOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const getInputPlaceholder = () => {
    const inputDir = getTextDirection(inputMessage);

    if (inputDir === "rtl") {
      return t("inputPlaceholderAr");
    }
    return isMobile ? t("inputPlaceholderMobile") : t("inputPlaceholder");
  };

  const TEXTAREA_MAX_HEIGHT = 160;

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const capped = el.scrollHeight > TEXTAREA_MAX_HEIGHT;
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    el.style.overflowY = capped ? "auto" : "hidden";
  }, [inputRef]);

  useEffect(() => { resizeTextarea(); }, [inputMessage, resizeTextarea]);

  const placeholder = getInputPlaceholder();

  return (
    <div className={`shrink-0 p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[background-color,border-color] duration-500 ${
      isInitialState
        ? "bg-transparent border-t-0 w-full max-w-2xl mx-auto"
        : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-700/60"
    }`}>
      <div className={`mx-auto space-y-2 sm:space-y-3 ${isInitialState ? "w-full" : "max-w-4xl"}`}>
        {/* Input area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="relative">
            {/* Interactive Focus Ambient Aura */}
            <motion.div
              animate={{
                opacity: isFocused ? 1 : 0,
                scale: isFocused ? 1.02 : 0.98,
              }}
              transition={{ duration: 0.3 }}
              className={`absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-sky-500/15 to-indigo-500/20 blur-xl pointer-events-none z-0 ${
                isInitialState ? "rounded-2xl sm:rounded-[2rem]" : "rounded-2xl"
              }`}
            />
            <div className={`relative z-10 flex flex-col gap-1 bg-white/80 dark:bg-slate-800/80 border-2 backdrop-blur-md shadow-sm transition-all duration-300 ${
              isInitialState
                ? "rounded-2xl sm:rounded-[2rem] p-2 sm:p-3 border-slate-200/60 dark:border-slate-700/50 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                : "rounded-2xl p-1.5 sm:p-2 border-slate-200/80 dark:border-slate-700/70 focus-within:border-cyan-500/60"
            }`}>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                dir="auto"
                className={`w-full max-h-[160px] bg-transparent border-0 focus:ring-0 outline-none focus:outline-none resize-none text-slate-900 dark:text-white leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium text-base scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 ${isRTL ? "text-right placeholder:text-right" : "text-left placeholder:text-left"} ${
                  isInitialState
                    ? "min-h-[52px] sm:min-h-[60px] py-2 px-1 sm:px-1.5 text-base sm:text-lg"
                    : "min-h-[24px] py-1 px-0.5 sm:px-1 text-base"
                }`}
              />
              <div className="flex items-center justify-between gap-2">
                {/* Start side: (+) tools button + model pill */}
                <div className="flex items-center gap-2">
                  {/* (+) Tools Button */}
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        setIsModelOpen(false);
                        setIsToolsOpen(!isToolsOpen);
                      }}
                      disabled={isLoading}
                      title={t("tools")}
                      aria-label={t("tools")}
                      type="button"
                      className={`shrink-0 flex items-center justify-center rounded-full transition-colors duration-300 w-9 h-9 sm:w-10 sm:h-10 ${
                        isLoading
                          ? "text-slate-300 dark:text-slate-600 bg-white/5 dark:bg-slate-800/5"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-95"
                      }`}
                    >
                      <Plus className={isInitialState ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4 sm:w-5 sm:h-5"} />
                    </motion.button>

                    {/* Tools popover overlay */}
                    <AnimatePresence>
                      {isToolsOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsToolsOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full start-0 mb-2 w-64 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-40 p-1.5"
                          >
                            {/* Quick Quiz */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsToolsOpen(false);
                                setIsQuickQuizOpen(true);
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                            >
                              <Brain className="w-4 h-4 shrink-0" />
                              {t("quickQuizFromText")}
                            </button>

                            {/* Divider */}
                            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700/60" />

                            {/* Mode switcher */}
                            {modes.map((m) => {
                              const Icon = m.icon;
                              const isActive = mode === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setIsToolsOpen(false);
                                    setMode(m.id);
                                  }}
                                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold transition-colors ${
                                    isActive
                                      ? "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                                  }`}
                                >
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span className="flex-1 text-start">{t(m.labelKey)}</span>
                                  {isActive && <Check className="w-4 h-4 shrink-0 text-cyan-500" />}
                                </button>
                              );
                            })}

                            {/* Divider */}
                            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700/60" />

                            {/* Summarize */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsToolsOpen(false);
                                onSummarizeChat();
                              }}
                              disabled={isSummarizing || !hasChatData}
                              className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold transition-colors ${
                                isSummarizing || !hasChatData
                                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              {isSummarizing ? (
                                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
                              ) : (
                                <SummaryIcon className="w-4 h-4 shrink-0" />
                              )}
                              {summaryConfig.title}
                            </button>

                            {/* Clear chat */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsToolsOpen(false);
                                onClearChat();
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" />
                              {t("clearChat")}
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Model Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsOpen(false);
                        setIsModelOpen(!isModelOpen);
                      }}
                      aria-label={t("model")}
                      className="text-[11px] sm:text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:opacity-80 flex items-center gap-1 transition-all py-1 px-2 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-lg border border-cyan-500/20 whitespace-nowrap"
                    >
                      {currentModel.label}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isModelOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isModelOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsModelOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full start-0 mb-2 w-56 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-40 p-1.5"
                          >
                            {models.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setIsModelOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-colors ${
                                  selectedModel === m.id
                                    ? "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-bold text-xs sm:text-sm">{m.label}</span>
                                  <span className="text-[10px] opacity-60">{m.provider}</span>
                                </div>
                                {selectedModel === m.id && (
                                  <Check className="w-4 h-4 text-cyan-500 shrink-0" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Send Button — end side */}
                <motion.button
                  whileHover={!inputMessage.trim() || isLoading ? {} : { scale: 1.06 }}
                  whileTap={!inputMessage.trim() || isLoading ? {} : { scale: 0.94 }}
                  onClick={onSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  aria-label={t("send")}
                  type="button"
                  className={`shrink-0 flex items-center justify-center rounded-full transition-all duration-300 w-9 h-9 sm:w-10 sm:h-10 ${
                    !inputMessage.trim() || isLoading
                      ? "text-slate-300 dark:text-slate-600 bg-slate-200/50 dark:bg-slate-700/40"
                      : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/40"
                  }`}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Send className={`${isInitialState ? "w-4 h-4 sm:w-5 sm:h-5" : "w-4 h-4"} ${isRTL ? "rotate-180" : ""}`} />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          dir="auto"
          className={`text-center text-slate-500 dark:text-slate-400 font-medium transition-colors ${
            isInitialState ? "text-[10px] sm:text-xs mt-1.5 sm:mt-2" : "text-[10px] sm:text-xs"
          }`}
        >
          {t("aiDisclaimer")}
        </motion.p>
      </div>

      <QuickQuizFromTextModal
        isOpen={isQuickQuizOpen}
        onClose={() => setIsQuickQuizOpen(false)}
        onGenerated={(data, sourceText) => {
          setQuickQuizData(data);
          setQuickQuizSourceText(sourceText);
          setIsQuickQuizOpen(false);
          setIsQuickQuizPlayerOpen(true);
        }}
      />

      <QuickQuizPlayerModal
        isOpen={isQuickQuizPlayerOpen}
        quizData={quickQuizData}
        sourceText={quickQuizSourceText}
        user={user}
        onClose={() => {
          setIsQuickQuizPlayerOpen(false);
          setQuickQuizData(null);
          setQuickQuizSourceText("");
        }}
      />
    </div>
  );
}
