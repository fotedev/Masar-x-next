"use client";

import { useState, useEffect, useCallback, useId, useRef, Children, memo, type FC, type ReactNode, type HTMLAttributes, isValidElement } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User, Copy, Check, Code, Eye, LogIn, RotateCcw } from "lucide-react";
import { getTextDirection } from "@/utils/textDirection";
import { LatexRenderer } from "@/components/LatexRenderer";
import { LazyMarkdown } from "@/components/ai/LazyMarkdown";
import { initPuterDiagnostics, signInToPuter, getPuterStatus } from "@/lib/puter";
import { CANNED_ERROR_PREFIXES } from "@/lib/ai/canned-messages";
import { motion, AnimatePresence } from "framer-motion";
import { LottiePlayer, type DotLottie } from "./LottiePlayer";
import { pickReactionEvent } from "@/lib/ai-assistant-reactions";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import {
  normalizeLatexDelimiters,
  repairBoldBoundaries,
  repairListGlue,
  repairSpacedBold,
} from "@/lib/ai/zaneMarkdown";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** True while this message is still receiving streamed deltas (spec 011). */
  streaming?: boolean;
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
  /** Re-sends the last user prompt. Only offered on the latest error bubble. */
  onRetry?: () => void;
}

/**
 * Dedicated copy button for chat messages. Module-scoped to preserve
 * identity and avoid recreating on every parent re-render.
 */
const MessageCopyButton = ({ content }: { content: string }) => {
  const tAi = useTranslations("aiAssistant");
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors"
      title={isCopied ? tAi("copied") : tAi("copyContent")}
      aria-label={isCopied ? tAi("copied") : tAi("copyContent")}
    >
      {isCopied ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
};

/**
 * Renders a fenced code block styled like ChatGPT / Gemini:
 * distinct dark background (#0d1117), clean top header bar with language label
 * and dedicated copy button.
 */
const CodeBlock = ({
  code,
  language,
  children,
}: {
  code: string;
  language?: string;
  children?: ReactNode;
}) => {
  const tAi = useTranslations("aiAssistant");
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className="relative group/codeblock my-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1117] shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-slate-800/80">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
          title={tAi("copyCode")}
          aria-label={tAi("copyCode")}
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">{tAi("copied")}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{tAi("copyCode")}</span>
            </>
          )}
        </button>
      </div>
      <pre
        dir="ltr"
        className="w-full overflow-x-auto p-4 sm:p-5 text-sm leading-relaxed"
      >
        <code
          className="block text-slate-100 font-mono"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {children ?? code}
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
  onRetry,
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
  // Errors reach the transcript two ways: useAiChat's catch appends a message
  // with an `error_` id, while assistant.ts's catch RESOLVES with a canned
  // string (a "successful" response) — those are only recognizable by content.
  // The shared prefix list covers every canned error in both locales; the
  // guard test locks the contract (lib/__tests__/cannedErrorPrefixes.test.ts).
  const isErrorMessage =
    !isUser &&
    typeof message.content === "string" &&
    (message.id.startsWith("error_") || CANNED_ERROR_PREFIXES.some((p) => message.content.startsWith(p)));

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

  // react-markdown hands p/li children with inline elements ALREADY replaced
  // by our styled components. Flattening them to plain text (as before) threw
  // that inline formatting away — bold/italic/inline code inside paragraphs
  // and list items silently vanished. Pass elements through and apply LaTeX
  // handling only to the text runs.
  const renderInlineChildren = (children: ReactNode): ReactNode =>
    Children.toArray(children).map((child, i) => {
      if (typeof child === "string" || typeof child === "number") {
        return <LatexRenderer key={i} text={String(child)} />;
      }
      return child;
    });

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



  const renderAssistantContent = (content: string) => {
    const raw = String(content ?? "");
    const normalized = repairListGlue(
      repairBoldBoundaries(repairSpacedBold(normalizeLatexDelimiters(raw))),
    );

    const markdownComponents = {
      // Spec 011 bidi: block-level plaintext isolation — see .zane-bidi-plaintext
      // in index.css. Applied to every block container so each block picks its
      // own first-strong direction instead of inheriting the bubble's.
      h1: ({ children }: { children?: ReactNode }) => (
        <h1 className="zane-bidi-plaintext text-xl sm:text-2xl font-black mt-6 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h1>
      ),
      h2: ({ children }: { children?: ReactNode }) => (
        <h2 className="zane-bidi-plaintext text-lg sm:text-xl font-bold mt-5 mb-3 text-slate-800 dark:text-slate-100 tracking-tight">
          <LatexRenderer text={flattenChildren(children)} />
        </h2>
      ),
      h3: ({ children }: { children?: ReactNode }) => (
        <h3 className="zane-bidi-plaintext text-base sm:text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-200">
          <LatexRenderer text={flattenChildren(children)} />
        </h3>
      ),
      p: ({ children }: { children?: ReactNode }) => (
        <div className="zane-bidi-plaintext mb-3 leading-7 sm:leading-[1.75] last:mb-0 text-slate-800 dark:text-slate-100">
          {renderInlineChildren(children)}
        </div>
      ),
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="zane-ul my-4 space-y-2 list-none p-0">
          {children}
        </ul>
      ),
      ol: ({ start, children }: { start?: number | string; children?: ReactNode }) => {
        // Model output can start a list at N ≠ 1 (`3. …`). The CSS counter
        // defaults to 0, so seed it from the list's own `start` or every
        // such list renders as 1..n.
        const first = Number(start);
        const seed = Number.isFinite(first) && first > 1 ? Math.floor(first) : null;
        return (
          <ol
            className="zane-ol my-4 space-y-2 list-none p-0"
            start={seed ?? undefined}
            style={seed ? { counterReset: `zane-item ${seed - 1}` } : undefined}
          >
            {children}
          </ol>
        );
      },
      li: ({ children }: { children?: ReactNode }) => (
        <li dir="auto" className="flex gap-2.5 items-start group">
          <div className="zane-bidi-plaintext flex-1 min-w-0 text-slate-800 dark:text-slate-100 leading-7 sm:leading-[1.75]">
            {renderInlineChildren(children)}
          </div>
        </li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        // border-s is logical: right edge in RTL, left edge in LTR.
        <blockquote className="zane-bidi-plaintext my-4 border-s-4 border-cyan-500 bg-slate-100/70 dark:bg-slate-800/40 ps-4 pe-3 py-2.5 rounded-e-xl text-slate-600 dark:text-slate-300">
          {children}
        </blockquote>
      ),
      del: ({ children }: { children?: ReactNode }) => (
        // slate-300 in dark mode: slate-400/80 was near-unreadable on the
        // dark bubble while still visibly struck through.
        <del className="line-through decoration-slate-400/70 text-slate-500 dark:text-slate-300">
          {children}
        </del>
      ),
      input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
        // GFM task-list checkboxes render as real disabled inputs.
        <input {...props} className="mt-1.5 accent-cyan-500 w-3.5 h-3.5" />
      ),
      // GFM tables: scroll horizontally instead of squeezing, isolate bidi
      // per cell (mixed Arabic/English cells), strong header/row structure
      // with zebra striping for scannability.
      table: ({ children }: { children?: ReactNode }) => (
        <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white/60 dark:bg-slate-900/40 shadow-sm">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            {children}
          </table>
        </div>
      ),
      tr: ({ children }: { children?: ReactNode }) => (
        <tr className="even:bg-slate-50/80 dark:even:bg-slate-800/30">{children}</tr>
      ),
      thead: ({ children }: { children?: ReactNode }) => (
        <thead className="bg-slate-100 dark:bg-slate-800/80">{children}</thead>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th
          dir="auto"
          className="px-3.5 py-2.5 text-start font-bold text-slate-800 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 whitespace-nowrap"
        >
          {children}
        </th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td
          dir="auto"
          className="px-3.5 py-2.5 text-start align-top text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/60"
        >
          {children}
        </td>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
        // Arabic UI fonts have no true oblique glyphs — synthetic italics are
        // near-invisible, so color carries the emphasis too.
        <em className="italic text-cyan-700 dark:text-cyan-300/90">{children}</em>
      ),
      code: ({ children, ...props }: MarkdownCodeProps) => {
        // react-markdown v10 dropped the `inline` prop: bare `code` is always
        // inline here (block code arrives via our `pre` handler below).
        // dir="auto" isolates the code run bidi-wise (HTML dir ⇒
        // unicode-bidi: isolate) so tokens like `foo.bar()` keep LTR order
        // inside an RTL sentence (spec 011).
        return (
          <code
            dir="auto"
            className="bg-slate-100 dark:bg-slate-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md text-[0.9em] font-mono font-medium border border-slate-200/50 dark:border-slate-700/50"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }: { children?: ReactNode }) => {
        // Block code: react-markdown wraps the fenced block as
        // <pre><code class="language-x">…</code></pre>. With rehype-highlight
        // active the code children are already highlighted spans — pass them
        // through to CodeBlock as-is and keep flattenChildren output only for
        // the copy button. The language-markdown escape hatch re-renders
        // markdown blocks the model nested inside a fence.
        const codeEl = Children.toArray(children).find(
          (c): c is React.ReactElement<MarkdownCodeProps> =>
            isValidElement(c) && (c.props as MarkdownCodeProps).className !== undefined,
        );
        const className = (codeEl?.props as MarkdownCodeProps)?.className || "";
        const inner = flattenChildren(codeEl ? (codeEl.props as MarkdownCodeProps).children : children);
        const match = /language-([\w-]+)/.exec(className || "");
        const lang = (match?.[1] || "").toLowerCase();
        if (lang === "markdown" || lang === "md") {
          return (
            <div className="my-4">
              <LazyMarkdown content={normalizeLatexDelimiters(inner)} components={markdownComponents} />
            </div>
          );
        }
        return (
          <CodeBlock code={inner} language={lang || undefined}>
            {codeEl ? (codeEl.props as MarkdownCodeProps).children : null}
          </CodeBlock>
        );
      },
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
        className={`flex gap-2.5 sm:gap-4 ${
          // Assistant messages take the full 4xl column (tables/code need the
          // room); user messages stay content-hugging chat style.
          isUser ? "max-w-[85%] sm:max-w-[88%] md:max-w-[82%] lg:max-w-[75%]" : "w-full"
        } ${directionClass}`}
      >
        <div
          className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-1 ${
            isUser
              ? // Spec 012: 32/36px user avatar — the 48/64px circle dwarfed
                // short messages. The bot avatar keeps its size (Lottie room).
                "w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-600 text-white shadow-md border border-white/20"
              : "w-12 h-12 sm:w-16 sm:h-16 bg-transparent"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
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
        <div className="flex flex-col gap-1 min-w-0 flex-1 group/bubble">
          <div
            className={`relative break-words text-[15px] sm:text-[16px] leading-7 sm:leading-[1.75] ${
              isUser
                ? `px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 ${roundedClass}`
                : // Spec 012: assistant replies flow on the canvas (ChatGPT-
                  // style clean reading surface) — no card box. Code blocks,
                  // the raw view and zane-ui blocks keep their own containers.
                  "text-slate-900 dark:text-slate-100"
            }`}
            dir={getTextDirection(displayContent)}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : message.streaming ? (
              // While deltas are still arriving: plain text only. Re-parsing
              // growing markdown (plus rehype-highlight) per frame is costly
              // and mid-fence states render as junk; the full pipeline takes
              // over at finalize.
              <div className="whitespace-pre-wrap">{displayContent}</div>
            ) : (
              <div className="space-y-3">
                {isErrorMessage ? (
                  <div
                    aria-live="polite"
                    className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap"
                  >
                    {displayContent}
                    {/* Retry re-sends the last user prompt as a fresh exchange
                        (the old error stays in the transcript as history, and the
                        resent prompt appears as a new user bubble — ChatGPT-style
                        in-place regeneration was explicitly declined for this pass).
                        Gated to the latest assistant turn + not loading, so a
                        stale error never retries the wrong prompt and a second
                        click can't double-fire while a request is in flight.
                        Unlimited user-paced retries are deliberate v1 scope (no
                        cooldown or cap; the canned text itself directs to
                        switching models on quota errors). */}
                    {onRetry && isLatestAssistant && !isLoading && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onRetry();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 transition-colors"
                          title={tAi("retry")}
                          aria-label={tAi("retry")}
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          {tAi("retry")}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  renderAssistantContent(displayContent)
                )}

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
          {/* Per-message actions under the message. Reveal is keyed to the
              `hover-device` variant (@media (any-hover: hover)), NOT to `sm:`:
              touch tablets are >= 640px but never fire :hover, so a breakpoint
              key would leave this row permanently invisible there.
              - Assistant: statically visible (subtle) on touch; hover/focus
                reveal on hover-capable devices.
              - User: hover/focus-only. On touch the dedicated button is
                unreachable BY DESIGN (approved spec: the user's own text is
                natively select-and-copyable; a permanent per-bubble button on
                the sender's own messages is clutter).
              - focus-within is scoped to hover-device deliberately: a global
                focus-within re-introduces the mobile touch-latch bug where a
                tapped button kept the row stuck visible. The cost — no Tab
                reveal on touch-primary devices with a keyboard — is an
                accepted tradeoff. */}
          {!message.streaming && (
            <div
              className={`flex items-center gap-1 pt-1 transition-opacity duration-150 ${
                isUser !== isRTL ? "justify-end" : "justify-start"
              } ${
                isUser
                  ? "opacity-0 pointer-events-none hover-device:group-hover/bubble:opacity-100 hover-device:group-hover/bubble:pointer-events-auto hover-device:focus-within:opacity-100 hover-device:focus-within:pointer-events-auto"
                  : "opacity-70 hover:opacity-100 pointer-events-auto hover-device:opacity-0 hover-device:group-hover/bubble:opacity-100 hover-device:focus-within:opacity-100"
              }`}
            >
              <MessageCopyButton content={displayContent} />
              {!isUser && hasMarkdownContent(displayContent) && (
                <button
                  onClick={() => setIsRawView(!isRawView)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors"
                  title={isRawView ? tAi("viewRendered") : tAi("viewSource")}
                  aria-label={isRawView ? tAi("viewRendered") : tAi("viewSource")}
                  type="button"
                >
                  {isRawView ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
