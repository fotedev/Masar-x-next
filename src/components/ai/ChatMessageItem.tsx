"use client";

import React from "react";
import { User, Bot } from "lucide-react";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
}) => {
  const isUser = message.type === "user";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`flex gap-3 max-w-[85%] ${
          isUser ? "flex-row" : "flex-row-reverse"
        }`}
      >
        <div
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isUser ? "bg-brand-blue text-white" : "bg-brand-orange text-white"
          }`}
        >
          {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </div>
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-brand-blue text-white rounded-tr-none"
              : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
          <div
            className={`text-[10px] mt-2 opacity-50 ${
              isUser ? "text-white" : "text-slate-500"
            }`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
