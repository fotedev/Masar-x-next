import { useState, useEffect, useCallback } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { Brain, Send } from "lucide-react";
import { getTextDirection } from "@/utils/textDirection";

import { motion } from "framer-motion";
import { QuickQuizFromTextModal } from "@/components/ai/QuickQuizFromTextModal";
import { QuickQuizPlayerModal } from "@/components/ai/QuickQuizPlayerModal";
import { useLocale } from "next-intl";

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
}

export function ChatInput({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  inputRef,
  t,
  isInitialState = false,
  user = null,
}: Omit<ChatInputProps, "suggestions" | "onSuggestionClick">) {
  const [isMobile, setIsMobile] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [isQuickQuizOpen, setIsQuickQuizOpen] = useState(false);
  const [isQuickQuizPlayerOpen, setIsQuickQuizPlayerOpen] = useState(false);
  const [quickQuizData, setQuickQuizData] = useState<LocalQuizData | null>(null);
  const [quickQuizSourceText, setQuickQuizSourceText] = useState("");
  const locale = useLocale();
  const isRTL = locale === "ar";

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px is Tailwind's 'sm' breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
                {/* Brain Button (Quick Quiz) — start side */}
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setIsQuickQuizOpen(true)}
                  disabled={isLoading}
                  title={t("quickQuizFromText")}
                  aria-label={t("quickQuizFromText")}
                  type="button"
                  className={`shrink-0 flex items-center justify-center rounded-xl transition-colors duration-300 w-9 h-9 sm:w-10 sm:h-10 ${
                    isLoading
                      ? "text-slate-300 dark:text-slate-600 bg-white/5 dark:bg-slate-800/5"
                      : "text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-cyan-500 active:scale-95"
                  }`}
                >
                  <Brain className={isInitialState ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4 sm:w-5 sm:h-5"} />
                </motion.button>

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
