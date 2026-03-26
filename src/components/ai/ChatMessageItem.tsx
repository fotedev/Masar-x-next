"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { Bot, User, Copy, Check, Code, Eye, LogIn } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { LatexRenderer } from "@/components/LatexRenderer";
import { signInToPuter } from "@/lib/puter";

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
  const locale = useLocale();
  const isRTL = locale === "ar";
  const isUser = message.type === "user";
  const [isRawView, setIsRawView] = useState(false);
  const [isPuterSigningIn, setIsPuterSigningIn] = useState(false);

  const PUTER_AUTH_MARKER = "__PUTER_AUTH_REQUIRED__";
  const isPuterAuthRequiredMessage =
    !isUser && typeof message.content === "string" && message.content.startsWith(PUTER_AUTH_MARKER);
  const displayContent = isPuterAuthRequiredMessage
    ? message.content.replace(PUTER_AUTH_MARKER, "").trim()
    : message.content;

  type MarkdownCodeProps = React.HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  };

  const hasMarkdownContent = (text: string): boolean => {
    const raw = String(text ?? "");
    // Check for code blocks, LaTeX, headings, lists, or inline formatting
    return (
      raw.includes("```") ||
      raw.includes("$$") ||
      raw.includes("$") ||
      raw.includes("\\[") ||
      raw.includes("\\(") ||
      /^#\s/m.test(raw) || // Headings at start of line
      /^\s*[-*+]\s/m.test(raw) || // Unordered lists
      /^\s*\d+\.\s/m.test(raw) || // Ordered lists
      /`[^`]+`/.test(raw) || // Inline code
      /\*\*[^*]+\*\*/.test(raw) || // Bold
      /__[^_]+__/.test(raw) || // Bold
      /\*[^*]+\*/.test(raw) || // Italic
      /_[^_]+_/.test(raw) // Italic
    );
  };

  const normalizeLatexDelimiters = (text: string) => {
    return String(text ?? "")
      .replace(/\\\[([\s\S]*?)\\\]/g, "$$$1$$")
      .replace(/\\\(([\s\S]*?)\\\)/g, "$$1$");
  };

  const flattenChildren = (children: React.ReactNode): string => {
    return React.Children.toArray(children).reduce<string>((text, child) => {
      if (typeof child === "string" || typeof child === "number") {
        return text + child;
      }

      if (React.isValidElement(child)) {
        const childChildren = (child.props as { children?: React.ReactNode })
          .children;

        if (childChildren) {
          return text + flattenChildren(childChildren);
        }
      }

      return text;
    }, "");
  };

  const CopyButton = ({ content }: { content: string }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        setIsCopied(false);
      }
    };

    return (
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 hover:text-cyan-500 transition-all duration-200 z-10 backdrop-blur-sm"
        title="Copy content"
      >
        {isCopied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  const renderAssistantContent = (content: string) => {
    const raw = String(content ?? "");
    const normalized = normalizeLatexDelimiters(raw);

    const markdownComponents: Components = {
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="text-xl sm:text-2xl font-black mt-6 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="text-lg sm:text-xl font-bold mt-5 mb-3 text-slate-800 dark:text-slate-100 tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-base sm:text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-200">
          <LatexRenderer text={flattenChildren(children)} />
        </h3>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <div className="mb-3 leading-relaxed last:mb-0 text-slate-700 dark:text-slate-300">
          <LatexRenderer text={flattenChildren(children)} />
        </div>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="space-y-2 my-4 list-none p-0">
          {children}
        </ul>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="flex gap-2 items-start group">
          <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          <div className="flex-1 text-slate-700 dark:text-slate-300">
            <LatexRenderer text={flattenChildren(children)} />
          </div>
        </li>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => (
        <em className="italic opacity-90">{children}</em>
      ),
      code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
        if (inline) {
          return (
            <code
              className="bg-slate-100 dark:bg-slate-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md text-[0.9em] font-mono font-medium border border-slate-200/50 dark:border-slate-700/50"
              {...props}
            >
              {children}
            </code>
          );
        }

        const match = /language-([\w-]+)/.exec(className || "");
        const lang = (match?.[1] || "").toLowerCase();
        if (lang === "markdown" || lang === "md") {
          const inner = normalizeLatexDelimiters(flattenChildren(children));
          return (
            <div className="my-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {inner}
              </ReactMarkdown>
            </div>
          );
        }

        return (
          <div className="relative group my-4">
            <pre
              dir="ltr"
              className="w-full overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-950 p-4 text-[13px] leading-relaxed shadow-lg transition-all duration-200 group-hover:border-slate-500/50"
            >
              <code
                className="block text-slate-100/95 font-mono"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
                {...props}
              >
                {children}
              </code>
            </pre>
          </div>
        );
      },
      pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    };

    if (isRawView) {
      return (
        <div className="relative group">
          <pre
            dir="ltr"
            className="w-full my-2 overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-950 p-4 text-[13px] leading-relaxed shadow-inner"
          >
            <code 
              className="block text-slate-300 font-mono"
              style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                overflowWrap: 'anywhere' 
              }}
            >
              {raw}
            </code>
          </pre>
        </div>
      );
    }

    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    );
  };

  const alignmentClass = (isUser !== isRTL) ? "justify-end" : "justify-start";
  const directionClass = (isUser !== isRTL) ? "flex-row-reverse" : "flex-row";
  const roundedClass = isUser 
    ? (isRTL ? "rounded-tr-sm" : "rounded-tl-sm")
    : (isRTL ? "rounded-tl-sm" : "rounded-tr-sm");
  
  const timestampAlignmentClass = (isUser !== isRTL) ? "text-right" : "text-left";

  return (
    <div
      className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 px-1 sm:px-0 ${alignmentClass}`}
    >
      <div
        className={`flex gap-3 w-full max-w-full sm:max-w-[85%] md:max-w-[80%] ${directionClass}`}
      >
        <div
          className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm mt-1 ${
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
            className={`px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed shadow-sm relative group/bubble ${
              isUser
                ? `bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/60 ${roundedClass}`
                : `bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 ${roundedClass}`
            }`}
          >
            <div className={`absolute -top-3 ${isUser ? (isRTL ? "right-4" : "left-4") : (isRTL ? "left-4" : "right-4")} flex gap-2 z-20 ${isRTL ? "flex-row-reverse" : "flex-row"}`}> 
              {/* Global Copy Button for all messages */}
              <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/bubble:pointer-events-auto">
                <CopyButton content={displayContent} />
              </div>

              {/* Source Toggle for Assistant messages with Markdown */}
              {!isUser && hasMarkdownContent(displayContent) && (
                <button
                  onClick={() => setIsRawView(!isRawView)}
                  className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 hover:text-cyan-500 transition-all duration-200"
                  title={isRawView ? "View Rendered" : "View Source"}
                >
                  {isRawView ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="space-y-3">
                {renderAssistantContent(displayContent)}
                {isPuterAuthRequiredMessage && (
                  <div className={`flex ${isRTL ? "justify-end" : "justify-start"}`}>
                    <button
                      type="button"
                      disabled={isPuterSigningIn}
                      onClick={async () => {
                        if (isPuterSigningIn) return;
                        setIsPuterSigningIn(true);
                        try {
                          await signInToPuter();
                        } finally {
                          setIsPuterSigningIn(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isPuterSigningIn ? "جاري فتح تسجيل الدخول..." : "تسجيل الدخول"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div
            className={`text-[11px] px-2 font-medium opacity-60 text-slate-500 ${timestampAlignmentClass}`}
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
