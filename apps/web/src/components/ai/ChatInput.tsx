import { useState, useEffect, useCallback, useRef } from "react";
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
  Settings,
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
  onOpenPuterSettings: () => void;
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
  onOpenPuterSettings,
}: Omit<ChatInputProps, "suggestions" | "onSuggestionClick">) {
  const [isMobile, setIsMobile] = useState(false);

  const [isQuickQuizOpen, setIsQuickQuizOpen] = useState(false);
  const [isQuickQuizPlayerOpen, setIsQuickQuizPlayerOpen] = useState(false);
  const [quickQuizData, setQuickQuizData] = useState<LocalQuizData | null>(null);
  const [quickQuizSourceText, setQuickQuizSourceText] = useState("");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isPersonaExpanded, setIsPersonaExpanded] = useState(false);

  // Outside-click dismissal: the composer card uses backdrop-blur, which makes it
  // the containing block for fixed-position children — viewport-size overlays
  // rendered inside it would only cover the card itself. A document-level
  // pointerdown listener with containment checks is the reliable dismissal.
  const toolsWrapRef = useRef<HTMLDivElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];
  const currentMode = modes.find((m) => m.id === mode) || modes[0];

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

  // Dismiss both menus on outside pointerdown or Escape
  useEffect(() => {
    if (!isToolsOpen && !isModelOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (toolsWrapRef.current?.contains(target)) return;
      if (modelWrapRef.current?.contains(target)) return;
      setIsToolsOpen(false);
      setIsModelOpen(false);
      setIsPersonaExpanded(false);
    };

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsToolsOpen(false);
        setIsModelOpen(false);
        setIsPersonaExpanded(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
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
    <div className="shrink-0 p-2 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-4xl space-y-2 sm:space-y-3">
        {/* Input area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className={`flex flex-col gap-1 border backdrop-blur-xl shadow-lg transition-colors duration-300 rounded-3xl bg-white/90 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-700/50 focus-within:border-slate-300 dark:focus-within:border-slate-600 ${
            isInitialState ? "p-3" : "p-2 sm:p-2.5"
          }`}>
            <textarea
              ref={inputRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
                placeholder={placeholder}
                dir={inputMessage ? "auto" : isRTL ? "rtl" : "ltr"}
              className={`w-full max-h-[160px] bg-transparent border-0 focus:ring-0 outline-none focus:outline-none resize-none text-slate-900 dark:text-white leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium text-base scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 ${
                isInitialState
                  ? "min-h-[52px] sm:min-h-[60px] py-2 px-1 sm:px-1.5 text-base sm:text-lg"
                  : "min-h-[24px] py-1 px-0.5 sm:px-1 text-base"
              }`}
            />
            <div className="flex items-center justify-between gap-2">
              {/* Start side: mode identity chip + (+) tools button + model pill.
                  Spec 012: the top header's identity (icon + label + status)
                  moved here as a compact chip — no separate bar above the
                  stream. Visible in the hero state too. */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                  <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-cyan-500/20 shrink-0">
                    <currentMode.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="hidden sm:inline text-xs font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[140px]">
                    {t(currentMode.labelKey)}
                  </span>
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="hidden md:inline text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {t("onlineReady")}
                  </span>
                </div>
                {/* (+) Tools Button */}
                <div className="relative" ref={toolsWrapRef}>
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      setIsModelOpen(false);
                      setIsPersonaExpanded(false);
                      setIsToolsOpen(!isToolsOpen);
                    }}
                    disabled={isLoading}
                    title={t("tools")}
                    aria-label={t("tools")}
                    aria-expanded={isToolsOpen}
                    type="button"
                    className={`shrink-0 flex items-center justify-center rounded-full transition-colors duration-300 w-9 h-9 sm:w-10 sm:h-10 ${
                      isLoading
                        ? "text-slate-300 dark:text-slate-600 bg-white/5 dark:bg-slate-800/5"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-95"
                    }`}
                  >
                    <Plus className={isInitialState ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4 sm:w-5 sm:h-5"} />
                  </motion.button>

                  <AnimatePresence>
                    {isToolsOpen && (
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

                        {/* Assistant persona accordion */}
                        <button
                          type="button"
                          onClick={() => setIsPersonaExpanded(!isPersonaExpanded)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          <Bot className="w-4 h-4 shrink-0" />
                          <span className="flex-1 min-w-0 text-start">{t("assistantPersona")}</span>
                          <span className="min-w-0 truncate max-w-[120px] sm:max-w-[150px] text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-md px-1.5 py-0.5">
                            {t(currentMode.labelKey)}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isPersonaExpanded ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {isPersonaExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              {modes.map((m) => {
                                const Icon = m.icon;
                                const isActive = mode === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setIsPersonaExpanded(false);
                                      setIsToolsOpen(false);
                                      setMode(m.id);
                                    }}
                                    className={`flex w-full items-center gap-2.5 ps-7 pe-3 py-2 rounded-xl text-start text-xs sm:text-sm font-bold transition-colors ${
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
                            </motion.div>
                          )}
                        </AnimatePresence>

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
                          disabled={!hasChatData}
                          className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold transition-colors ${
                            !hasChatData
                              ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              : "text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                          }`}
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          {t("clearChat")}
                        </button>

                        {/* Divider */}
                        <div className="my-1 h-px bg-slate-200 dark:bg-slate-700/60" />

                        {/* AI settings */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            onOpenPuterSettings();
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-start text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          <Settings className="w-4 h-4 shrink-0" />
                          {t("puterSettings")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Model Pill */}
                <div className="relative" ref={modelWrapRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsOpen(false);
                      setIsPersonaExpanded(false);
                      setIsModelOpen(!isModelOpen);
                    }}
                    aria-label={t("model")}
                    aria-expanded={isModelOpen}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-1 transition-colors py-1.5 px-2.5 rounded-lg border border-transparent whitespace-nowrap"
                  >
                    {currentModel.label}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${isModelOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isModelOpen && (
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
                    ? "text-slate-400 dark:text-slate-500 bg-slate-200/80 dark:bg-slate-700/60"
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
