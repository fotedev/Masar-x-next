"use client";

import { useState, useEffect, useCallback, useId, useRef, Children, memo, type FC, type ReactNode, type HTMLAttributes, isValidElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User, Copy, Check, Code, Eye, LogIn } from "lucide-react";
import { getTextDirection } from "@/utils/textDirection";
import { LatexRenderer } from "@/components/LatexRenderer";
import { LazyMarkdown } from "@/components/ai/LazyMarkdown";
import { initPuterDiagnostics, signInToPuter, getPuterStatus } from "@/lib/puter";
import { motion, AnimatePresence } from "framer-motion";
import { LottiePlayer, type DotLottie } from "./LottiePlayer";
import { pickReactionEvent } from "@/lib/ai-assistant-reactions";
import type { AiAssistantMode } from "@/lib/ai-assistant";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  onUiMessage?: (message: string) => void;
  /** Whether this message is the most recent assistant turn in the chat. */
  isLatestAssistant?: boolean;
  /** Whether the AI is currently generating a response. */
  isLoading?: boolean;
  /** Current AI assistant mode (used to pick the right reaction event). */
  mode?: AiAssistantMode;
}

/**
 * Renders a fenced code block with a copy button that copies *only* the
 * code snippet (not the whole message). Defined at the module level so
 * its internal `isCopied` state isn't reset on every parent re-render.
 */
const CodeBlock = ({ code }: { code: string }) => {
  const tAi = useTranslations("aiAssistant");
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className="relative group/codeblock my-4">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-slate-800/90 dark:bg-slate-700/90 border border-slate-600 shadow-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 backdrop-blur-sm flex items-center gap-1"
          title={tAi("copyCode")}
          aria-label={tAi("copyCode")}
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <pre
        dir="ltr"
        className="w-full overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-950 p-4 text-[13px] leading-relaxed shadow-lg transition-all duration-200 group-hover/codeblock:border-slate-500/50"
      >
        <code
          className="block text-slate-100/95 font-mono"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
};

export const ChatMessageItem: FC<ChatMessageItemProps> = memo(({
  message,
  onUiMessage,
  isLatestAssistant = false,
  isLoading = false,
  mode = "cs_assistant",
}) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const isUser = message.type === "user";
  const tAi = useTranslations("aiAssistant");
  const tAuth = useTranslations("auth");
  const [isRawView, setIsRawView] = useState(false);
  const [isPuterSigningIn, setIsPuterSigningIn] = useState(false);
  const [puterIsSignedIn, setPuterIsSignedIn] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lottiePlayerRef = useRef<DotLottie | null>(null);
  const wasLoadingRef = useRef(false);
  // Stable per-instance key for the bubble's LottiePlayer. The key changes
  // every time the parent re-mounts the bubble (e.g. when switching between
  // assistants with messages), which forces a clean rebuild of the WASM
  // player and avoids the "Failed to load animation" race condition that
  // happens when a stale canvas is reused.
  const lottieInstanceId = useId();

  type ZaneUiButton = { label: string; message: string };
  type ZaneUiPayload = { type: "buttons"; title?: string; buttons: ZaneUiButton[] };

  const PUTER_AUTH_MARKER = "__PUTER_AUTH_REQUIRED__";
  const isPuterAuthRequiredMessage =
    !isUser && typeof message.content === "string" && message.content.startsWith(PUTER_AUTH_MARKER);

  // Sync puter auth state with the SDK + localStorage (cross-tab aware).
  // The Puter SDK is external, so we poll + listen to focus/storage events
  // instead of subscribing to a dedicated auth-change channel.
  const refreshPuterStatus = useCallback(() => {
    try {
      const { isSignedIn } = getPuterStatus();
      setPuterIsSignedIn(isSignedIn);
    } catch {
      setPuterIsSignedIn(false);
    }
  }, []);

  useEffect(() => {
    if (!isPuterAuthRequiredMessage) {
      setPuterIsSignedIn(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    refreshPuterStatus();
    pollRef.current = setInterval(refreshPuterStatus, 1500);
    const onFocus = () => refreshPuterStatus();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "puter_signed_in" || e.key === "puter_unavailable_until") {
        refreshPuterStatus();
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [isPuterAuthRequiredMessage, refreshPuterStatus]);

  // Drive the bubble avatar's Lottie state machine based on chat state.
  // Only the latest assistant message reacts (thinking / yes / no / alert / jump).
  // Older bubbles stay on their default "idle" loop.
  //
  // Note: we intentionally ignore `hasUserInput` here — the bubble avatar
  // represents the assistant's *last delivered* message, so it should only
  // react when the AI is actually generating a new response (`isLoading`).
  // The hero Lottie in ChatContainer is the surface that reacts to typing.
  useEffect(() => {
    if (isUser || !isLatestAssistant) {
      wasLoadingRef.current = isLoading;
      return;
    }
    const player = lottiePlayerRef.current;
    if (!player) return;

    const safeFire = (event: string) => {
      try {
        player.stateMachineFireEvent(event);
      } catch {
        // state machine may not be ready; ignore
      }
    };

    const aiJustFinished = wasLoadingRef.current && !isLoading;
    wasLoadingRef.current = isLoading;

    if (aiJustFinished) {
      const event = pickReactionEvent(message.content, mode);
      safeFire(event);
      return;
    }

    if (isLoading) {
      safeFire("thinkClick");
    }
  }, [isLoading, isLatestAssistant, isUser, message.content, mode]);

  // The state machine's "thinking" segment is finite and auto-transitions
  // back to "idle" via the `thinkingComplete` event (see `StateMachine1.json`
  // in `public/animations/ai-robo.lottie`). To keep the bubble avatar
  // locked in "thinking" for the entire generation, we re-fire `thinkClick`
  // on a short interval while `isLoading` stays true.
  useEffect(() => {
    if (isUser || !isLatestAssistant || !isLoading) return;
    const interval = setInterval(() => {
      const player = lottiePlayerRef.current;
      if (!player) return;
      try {
        player.stateMachineFireEvent("thinkClick");
      } catch {
        // state machine may not be ready; ignore
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading, isLatestAssistant, isUser]);

  const extractZaneUiBlocks = (text: string): { cleaned: string; ui: ZaneUiPayload[] } => {
    const raw = String(text ?? "");
    const ui: ZaneUiPayload[] = [];
    const cleaned = raw.replace(/```zane-ui\s*([\s\S]*?)```/g, (_m, json) => {
      try {
        const parsed = JSON.parse(String(json ?? "").trim()) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed as { type?: unknown }).type === "buttons" &&
          Array.isArray((parsed as { buttons?: unknown }).buttons)
        ) {
          ui.push(parsed as ZaneUiPayload);
        }
      } catch {
        // ignore invalid blocks
      }
      return "";
    });
    return { cleaned: cleaned.trim(), ui };
  };

  const withoutPuterMarker = isPuterAuthRequiredMessage
    ? message.content.replace(PUTER_AUTH_MARKER, "").trim()
    : message.content;

  const { cleaned: displayContent, ui: zaneUiBlocks } = extractZaneUiBlocks(withoutPuterMarker);

  type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    className?: string;
    children?: ReactNode;
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

  const flattenChildren = (children: ReactNode): string => {
    return Children.toArray(children).reduce<string>((text, child) => {
      if (typeof child === "string" || typeof child === "number") {
        return text + child;
      }

      if (isValidElement(child)) {
        const childChildren = (child.props as { children?: ReactNode })
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
        title={tAi("copyContent")}
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

    const markdownComponents = {
      h1: ({ children }: { children?: ReactNode }) => (
        <h1 className="text-xl sm:text-2xl font-black mt-6 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h1>
      ),
      h2: ({ children }: { children?: ReactNode }) => (
        <h2 className="text-lg sm:text-xl font-bold mt-5 mb-3 text-slate-800 dark:text-slate-100 tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h2>
      ),
      h3: ({ children }: { children?: ReactNode }) => (
        <h3 className="text-base sm:text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-200">
          <LatexRenderer text={flattenChildren(children)} />
        </h3>
      ),
      p: ({ children }: { children?: ReactNode }) => (
        <div className="mb-3 leading-relaxed last:mb-0 text-slate-700 dark:text-slate-300">
          <LatexRenderer text={flattenChildren(children)} />
        </div>
      ),
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="space-y-2 my-4 list-none p-0">
          {children}
        </ul>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li className="flex gap-2 items-start group">
          <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          <div className="flex-1 text-slate-700 dark:text-slate-300">
            <LatexRenderer text={flattenChildren(children)} />
          </div>
        </li>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
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
              <LazyMarkdown content={inner} components={markdownComponents} />
            </div>
          );
        }

        // Block code → render via the shared <CodeBlock /> which adds a
        // per-snippet copy button (so users can copy the code alone instead
        // of the whole message).
        const codeText = flattenChildren(children);
        return <CodeBlock code={codeText} />;
      },
      pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
    };

    return (
      <div className="relative overflow-hidden min-h-[1.5em]">
        {/* Raw View */}
        <div 
          className={`transition-all duration-300 ease-in-out ${
            isRawView 
              ? "opacity-100 translate-y-0 relative" 
              : "opacity-0 translate-y-2 absolute inset-0 pointer-events-none"
          }`}
        >
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

        {/* Rendered View */}
        <div 
          className={`transition-all duration-300 ease-in-out ${
            !isRawView 
              ? "opacity-100 translate-y-0 relative" 
              : "opacity-0 -translate-y-2 absolute inset-0 pointer-events-none"
          }`}
        >
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <LazyMarkdown content={normalized} components={markdownComponents} />
          </div>
        </div>
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
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={`flex w-full px-1 sm:px-0 ${alignmentClass}`}
    >
      <div
        className={`flex gap-2.5 sm:gap-4 w-[95%] sm:w-auto max-w-[95%] sm:max-w-[88%] md:max-w-[82%] lg:max-w-[75%] ${directionClass}`}
      >
        <div
          className={`shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mt-1 ${
            isUser
              ? "bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-600 text-white shadow-md border border-white/20"
              : "bg-transparent"
          }`}
        >
          {isUser ? (
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <LottiePlayer
              key={lottieInstanceId}
              src="/animations/ai-robo.lottie"
              animationId="Main Scene"
              stateMachineId="StateMachine1"
              autoplay
              loop
              dotLottieRefCallback={(player: DotLottie | null) => {
                lottiePlayerRef.current = player;
              }}
              className="w-full h-full"
            />
          )}
        </div>
        <div className="flex flex-col gap-1 w-[calc(100%-3.5rem)] sm:w-auto">
          <div
            className={`px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-2xl sm:rounded-3xl text-[14.5px] sm:text-[15px] leading-relaxed shadow-sm relative group/bubble break-words ${
              isUser
                ? `bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 ${roundedClass}`
                : `bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/90 dark:to-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 ${roundedClass}`
            }`}
            dir={getTextDirection(displayContent)}
          >
            <div className={`absolute -top-3.5 ${isUser ? (isRTL ? "right-3" : "left-3") : (isRTL ? "left-3" : "right-3")} flex gap-1.5 sm:gap-2 z-20 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              {/* Global Copy Button for all messages */}
              <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/bubble:pointer-events-auto">
                <CopyButton content={displayContent} />
              </div>

              {/* Source Toggle for Assistant messages with Markdown */}
              {!isUser && hasMarkdownContent(displayContent) && (
                <button
                  onClick={() => setIsRawView(!isRawView)}
                  className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 hover:text-cyan-500 transition-all duration-200"
                  title={isRawView ? tAi("viewRendered") : tAi("viewSource")}
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

                {zaneUiBlocks.length > 0 && (
                  <div className="space-y-2">
                    {zaneUiBlocks.map((block, idx) => (
                      <div key={`zane_ui_${idx}`} className="space-y-2">
                        {block.title && (
                          <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200" dir="auto">
                            {block.title}
                          </div>
                        )}
                        <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-end" : "justify-start"}`}>
                          {block.buttons.map((b, bIdx) => (
                            <motion.button
                              key={`zane_btn_${idx}_${bIdx}`}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => onUiMessage?.(b.message)}
                              className="px-3 py-2 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/30 text-slate-800 dark:text-slate-100 font-extrabold text-sm hover:bg-white dark:hover:bg-slate-800/50 hover:border-cyan-500/40 hover:shadow-md transition-colors"
                            >
                              {b.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isPuterAuthRequiredMessage && (
                  <div className={`flex flex-col gap-2 ${isRTL ? "items-end" : "items-start"}`}>
                    <AnimatePresence mode="wait" initial={false}>
                      {puterIsSignedIn ? (
                        <motion.div
                          key="signed-in"
                          initial={{ opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-500/30 font-bold text-sm shadow-sm"
                          role="status"
                          aria-live="polite"
                        >
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                          <span>{tAi("signedIn")}</span>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="sign-in"
                          type="button"
                          disabled={isPuterSigningIn}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          onClick={async () => {
                            if (isPuterSigningIn) return;
                            setIsPuterSigningIn(true);
                            try {
                              initPuterDiagnostics();
                              const result = await signInToPuter();
                              if (result.ok && result.signedIn) {
                                setPuterIsSignedIn(true);
                                if (pollRef.current) clearInterval(pollRef.current);
                              }
                            } finally {
                              setIsPuterSigningIn(false);
                            }
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-60"
                        >
                          {isPuterSigningIn ? (
                            <span
                              className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <LogIn className="w-4 h-4" />
                          )}
                          <span>{isPuterSigningIn ? tAi("signingIn") : tAuth("signIn")}</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                    {puterIsSignedIn && (
                      <motion.p
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.05 }}
                        className="text-[12px] text-slate-500 dark:text-slate-400 px-1"
                        dir="auto"
                      >
                        {tAi("signedInRetryHint")}
                      </motion.p>
                    )}
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
    </motion.div>
  );
});
