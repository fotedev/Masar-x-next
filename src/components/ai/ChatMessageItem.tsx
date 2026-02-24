"use client";

import React from "react";
import { Bot, User } from "lucide-react";
import { LatexRenderer } from "@/components/LatexRenderer";

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

  const normalizeLatexDelimiters = (text: string) => {
    return String(text ?? "")
      .replace(/\\\[([\s\S]*?)\\\]/g, "$$$1$$")
      .replace(/\\\(([\s\S]*?)\\\)/g, "$$1$");
  };

  const renderAssistantContent = (content: string) => {
    const raw = String(content ?? "");

    const parts: Array<
      | { type: "text"; value: string }
      | { type: "code"; lang?: string; value: string }
    > = [];

    const fenceRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    for (const m of raw.matchAll(fenceRegex)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const before = raw.slice(lastIndex, start);
      if (before) parts.push({ type: "text", value: before });
      parts.push({ type: "code", lang: m[1] || undefined, value: m[2] ?? "" });
      lastIndex = end;
    }
    const remaining = raw.slice(lastIndex);
    if (remaining) parts.push({ type: "text", value: remaining });

    return (
      <div className="space-y-3">
        {parts.map((p, idx) => {
          if (p.type === "code") {
            return (
              <pre
                key={idx}
                dir="ltr"
                className="w-full overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-950 text-slate-100 p-4 text-[13px] leading-relaxed"
              >
                <code>{p.value}</code>
              </pre>
            );
          }
          const normalized = normalizeLatexDelimiters(p.value);
          return (
            <div key={idx} className="whitespace-pre-wrap">
              <LatexRenderer text={normalized} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isUser ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
          isUser ? "flex-row" : "flex-row-reverse"
        }`}
      >
        <div
          className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm ${
            isUser
              ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white"
              : "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div
            className={`px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed shadow-sm ${
              isUser
                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/60 rounded-tl-sm"
                : "bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 rounded-tr-sm"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              renderAssistantContent(message.content)
            )}
          </div>
          <div
            className={`text-[11px] px-2 font-medium opacity-60 ${
              isUser ? "text-slate-500 text-left" : "text-slate-500 text-right"
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
