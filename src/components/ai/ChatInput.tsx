import React from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  t: (key: string) => string;
}

export function ChatInput({
  inputMessage,
  setInputMessage,
  isLoading,
  onSendMessage,
  suggestions,
  onSuggestionClick,
  inputRef,
  t,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="shrink-0 p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-700/50">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Suggestions */}
        {inputMessage.length === 0 && suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(suggestion)}
                className="whitespace-nowrap px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all border border-slate-200/50 dark:border-slate-700/50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/5 dark:to-blue-500/5 rounded-2xl blur-xl transition-all group-focus-within:blur-2xl opacity-0 group-focus-within:opacity-100" />
          <div className="relative flex items-end gap-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-2 transition-all focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/50 shadow-sm">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inputPlaceholder")}
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none text-slate-900 dark:text-white py-2.5 px-3 text-sm sm:text-base leading-relaxed"
            />
            <button
              onClick={onSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${
                !inputMessage.trim() || isLoading
                  ? "text-slate-300 dark:text-slate-600"
                  : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 active:scale-95"
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-center text-slate-400 dark:text-slate-500 font-medium">
          {t("aiDisclaimer")}
        </p>
      </div>
    </div>
  );
}
