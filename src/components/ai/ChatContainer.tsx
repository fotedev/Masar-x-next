import React from "react";
import { ChatMessageItem } from "./ChatMessageItem";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  t: (key: string) => string;
}

export function ChatContainer({
  messages,
  isLoading,
  messagesContainerRef,
  messagesEndRef,
  t,
}: ChatContainerProps) {
  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
            <div className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t("welcomeTitle")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            {t("welcomeDesc")}
          </p>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start animate-in slide-in-from-left-2 duration-300">
              <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tr-none px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </>
      )}
    </div>
  );
}
