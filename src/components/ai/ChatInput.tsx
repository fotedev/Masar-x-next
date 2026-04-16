import { useState, useEffect } from "react";
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

  const placeholder = getInputPlaceholder();

  return (
    <div className={`shrink-0 p-4 sm:p-6 transition-[background-color,border-color] duration-500 ${
      isInitialState 
        ? "bg-transparent border-t-0 w-full max-w-2xl mx-auto" 
        : "bg-white dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-700/50"
    }`}>
      <div className={`mx-auto space-y-4 ${isInitialState ? "w-full" : "max-w-4xl"}`}>
        {/* Input area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className={`relative group flex items-stretch gap-2 sm:gap-3 ${isRTL ? "flex-row-reverse" : ""}`}
        >
          {/* Brain Button (Opposite side) */}
          <button
            onClick={() => setIsQuickQuizOpen(true)}
            disabled={isLoading}
            title="اختبار سريع من نص"
            className={`rounded-2xl transition-[colors,transform,box-shadow,border-color] duration-300 shrink-0 flex items-center justify-center border backdrop-blur-md self-stretch ${
              isInitialState ? "w-14 sm:w-[68px]" : "w-11 sm:w-12"
            } ${
              isLoading
                ? "text-slate-300 dark:text-slate-600 bg-white/5 dark:bg-slate-800/5 border-slate-200/30 dark:border-slate-700/30"
                : "bg-white/40 dark:bg-slate-800/40 text-cyan-600 dark:text-cyan-400 border-slate-200/50 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 active:scale-95"
            }`}
            type="button"
            aria-label="اختبار سريع من نص"
          >
            <Brain className={isInitialState ? "w-6 h-6" : "w-5 h-5"} />
          </button>

          <div className="relative flex-1 group/input">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-cyan-500/10 dark:from-cyan-500/5 dark:via-blue-500/2 dark:to-cyan-500/5 rounded-[2.5rem] blur-2xl transition-[filter,opacity] duration-500 group-focus-within/input:blur-3xl opacity-0 group-focus-within/input:opacity-100" />
            <div className={`relative flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 border-2 transition-[colors,box-shadow,border-color] duration-300 backdrop-blur-md shadow-sm h-full ${isRTL ? "flex-row-reverse" : ""} ${
              isInitialState 
                ? "rounded-[2rem] p-3 border-slate-200/50 dark:border-slate-700/40 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)]" 
                : "rounded-2xl p-2 border-slate-200/80 dark:border-slate-700/60 focus-within:border-cyan-500/50"
            }`}>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                dir="auto"
                className={`flex-1 max-h-32 bg-transparent border-0 focus:ring-0 resize-none text-slate-900 dark:text-white leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium ${isRTL ? "text-right placeholder:text-right" : "text-left placeholder:text-left"} ${
                  isInitialState 
                    ? "min-h-[60px] py-4 px-6 text-base sm:text-lg" 
                    : "min-h-[44px] py-2.5 px-3 text-sm sm:text-base"
                }`}
              />

              <button
                onClick={onSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className={`rounded-2xl transition-[colors,transform,box-shadow,background-image] duration-300 shrink-0 flex items-center justify-center backdrop-blur-sm self-stretch ${
                  isInitialState ? "w-14 h-14" : "w-11 h-11"
                } ${
                  !inputMessage.trim() || isLoading
                    ? "text-slate-300 dark:text-slate-600 bg-white/5 dark:bg-slate-800/5 border border-slate-200/20 dark:border-slate-700/20"
                    : "bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-600 hover:shadow-cyan-500/40 active:scale-95"
                }`}
                type="button"
                aria-label={t("send")}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Send className={`${isInitialState ? "w-6 h-6" : "w-5 h-5"} ${isRTL ? "rotate-180" : ""}`} />
                )}
              </button>
            </div>
          </div>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          dir="auto"
          className={`text-center text-slate-400 dark:text-slate-500 font-medium transition-[colors,opacity] ${
            isInitialState ? "text-xs sm:text-sm mt-6" : "text-[10px] sm:text-xs"
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
