import { useEffect, useState, useId, useRef, useMemo, useCallback, type RefObject } from "react";
import { useLocale } from "next-intl";
import {
  Bot,
  Brain,
  MessagesSquare,
  ChevronDown,
  Check,
  type LucideIcon,
  BookOpen,
  Code,
  Calendar,
  MessageCircle,
  LogIn,
  Settings,
} from "lucide-react";
import { ChatMessageItem } from "./ChatMessageItem";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LottiePlayer, type DotLottie } from "./LottiePlayer";
import { pickReactionEvent } from "@/lib/ai-assistant-reactions";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesContainerRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
  t: (key: string) => string;
  isInitialState?: boolean;
  mode?: AiAssistantMode;
  setMode?: (mode: AiAssistantMode) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onOpenPuterSettings?: () => void;
  isPuterSignedIn?: boolean;
  onUiMessage?: (message: string) => void;
  hasUserInput?: boolean;
}

export function ChatContainer({
  messages,
  isLoading,
  messagesContainerRef,
  messagesEndRef,
  t,
  isInitialState = false,
  mode = "cs_assistant",
  setMode,
  onSuggestionClick,
  onOpenPuterSettings,
  isPuterSignedIn = false,
  onUiMessage,
  hasUserInput = false,
}: ChatContainerProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  // Stable per-instance key for the hero LottiePlayer. The key is derived
  // from both the mode and a unique id so that switching between
  // assistants always forces a clean re-mount of the WASM player and
  // avoids the "Failed to load animation" race condition.
  const heroLottieInstanceId = useId();
  const menuId = "chat-initial-mode-menu";
  const locale = useLocale();
  const isRTL = locale === "ar";
  const assistantName = locale.toLowerCase().startsWith("ar") ? "زين" : "ZANE";

  // Lottie state machine ref for chat state integration
  const lottieRef = useRef<DotLottie | null>(null);
  // Separate ref for the typing-indicator avatar so we can drive it
  // independently (it should always play the "thinking" state while visible).
  const thinkingLottieRef = useRef<DotLottie | null>(null);

  // When the typing-indicator Lottie mounts, push it into the "thinking"
  // state right away. The state machine starts in "idle" by default, so we
  // have to fire `thinkClick` once initialization is complete.
  const handleThinkingLottieRef = useCallback((player: DotLottie | null) => {
    thinkingLottieRef.current = player;
    if (!player) return;
    const fire = () => {
      try {
        player.stateMachineFireEvent("thinkClick");
      } catch {
        // state machine may not be ready; ignore
      }
    };
    fire();
    // Retry once on the next tick in case the state machine wasn't fully
    // initialized when the ref was first set.
    setTimeout(fire, 50);
  }, []);

  // The state machine's "thinking" segment is finite and auto-transitions
  // back to "idle" via the `thinkingComplete` event (see `StateMachine1.json`
  // in `public/animations/ai-robo.lottie`). The hero stays in "thinking"
  // because the user typing constantly re-fires `thinkClick` through the
  // `hasUserInput` dependency. The typing indicator has no such driver, so
  // we re-fire `thinkClick` on a short interval for the duration of
  // `isLoading` to keep the avatar locked in "thinking".
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      const player = thinkingLottieRef.current;
      if (!player) return;
      try {
        player.stateMachineFireEvent("thinkClick");
      } catch {
        // state machine may not be ready; ignore
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Track the previous loading state and the last response we reacted to
  // so we can detect the transition from "AI is thinking" → "AI just answered"
  // and pick the right reaction (yes / no / alert) based on the response content.
  const wasLoadingRef = useRef(false);
  const lastReactedMessageIdRef = useRef<string | null>(null);

  // Drive the Lottie animation based on the chat state.
  // - Initial state (no input, no loading, no messages) → no event fired,
  //   the default "idle" state plays on its own.
  // - User typing or AI thinking → "thinking" segment.
  // - AI just answered → react with yes / no / alert depending on the reply.
  useEffect(() => {
    const player = lottieRef.current;
    if (!player) return;

    const safeFire = (event: string) => {
      try {
        player.stateMachineFireEvent(event);
      } catch {
        // state machine may not be ready; ignore
      }
    };

    // Detect the moment the AI finishes a response
    const aiJustFinished = wasLoadingRef.current && !isLoading;
    wasLoadingRef.current = isLoading;

    if (aiJustFinished && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (
        lastMessage &&
        lastMessage.type === "assistant" &&
        lastMessage.id !== lastReactedMessageIdRef.current
      ) {
        lastReactedMessageIdRef.current = lastMessage.id;
        const event = pickReactionEvent(lastMessage.content, mode);
        safeFire(event);
      }
      return;
    }

    // While typing or while the AI is generating → thinking
    if (isLoading || hasUserInput) {
      safeFire("thinkClick");
    }
    // Initial state: do nothing, let the default "idle" state play.
  }, [isLoading, hasUserInput, messages, mode]);

  // Index of the latest assistant message in the list. Used so only the most
  // recent AI bubble drives the avatar's state-machine events; older bubbles
  // stay on their default "idle" loop.
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.type === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const modes: { id: AiAssistantMode; icon: LucideIcon; label: string }[] = [
    { id: "cs_assistant", icon: Bot, label: t("assistantProgramming") },
    { id: "student_agent", icon: Brain, label: t("assistantStudent") },
    { id: "group_rag", icon: MessagesSquare, label: t("assistantGroupChat") },
  ];

  const currentMode = modes.find((m) => m.id === mode) || modes[0];

  useEffect(() => {
    if (!isDropdownOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDropdownOpen]);

  return (
    <div
      ref={messagesContainerRef}
      className={`flex-1 p-2 sm:p-4 space-y-3 sm:space-y-6 scroll-smooth chat-messages transition-[background-color,border-color] duration-500 ${
        isInitialState
          ? "flex flex-col items-center justify-center overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 py-2 sm:py-4"
          : "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 pb-6 sm:pb-12"
      }`}
    >
      {messages.length === 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={
            shouldReduceMotion
              ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
              : {
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.15,
                    },
                  },
                }
          }
          className="flex flex-col items-center justify-center text-center space-y-3 sm:space-y-5 max-w-2xl px-2 sm:px-4 my-auto w-full"
        >
          {/* Lottie AI Hero Animation */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : { hidden: { y: 15, opacity: 0 }, visible: { y: 0, opacity: 1 } }
            }
            className="w-full flex items-center justify-center"
          >
            <div className="w-48 h-48 md:w-56 md:h-56">
              <LottiePlayer
                key={`${mode}-${heroLottieInstanceId}`}
                src="/animations/ai-robo.lottie"
                animationId="Main Scene"
                stateMachineId="StateMachine1"
                autoplay
                loop
                dotLottieRefCallback={(player: DotLottie | null) => {
                  lottieRef.current = player;
                }}
                className="w-full h-full"
              />
            </div>
          </motion.div>

          {/* ZANE Brand + Welcome Title */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : { hidden: { y: 15, opacity: 0 }, visible: { y: 0, opacity: 1 } }
            }
            className="space-y-1 sm:space-y-2 flex flex-col items-center"
          >
            <h1
              className="text-3xl sm:text-5xl font-black tracking-tight"
              dir="auto"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 dark:from-cyan-300 dark:via-sky-200 dark:to-blue-400">
                {assistantName}
              </span>
            </h1>
            <h2
              className="text-xl sm:text-3xl font-black tracking-tight text-sky-500 dark:text-sky-400"
              dir="auto"
            >
              {t("welcomeTitle")}
            </h2>
          </motion.div>

          {/* Refined Dropdown with Cyan Inset/Border Glow */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }
            }
            className="relative mt-2"
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800/40 rounded-2xl border-2 transition-[colors,box-shadow,border-color] duration-300 group min-w-[220px] justify-between shadow-sm backdrop-blur-md ${
                isDropdownOpen
                  ? "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  : "border-slate-200/60 dark:border-slate-700/40 hover:border-cyan-500/30"
              }`}
              aria-expanded={isDropdownOpen}
              aria-controls={menuId}
              type="button"
            >
              <div className="flex items-center gap-3">
                <currentMode.icon
                  className={`w-5 h-5 transition-colors duration-300 ${isDropdownOpen ? "text-cyan-500" : "text-cyan-500"}`}
                />
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {currentMode.label}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180 text-cyan-500" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30 bg-slate-900/30 dark:bg-black/60 backdrop-blur-[2px] transition-opacity duration-200"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                    exit={{ opacity: 0, y: -10, scale: 0.95, x: "-50%" }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-1/2 mb-3 w-[min(16rem,calc(100vw-2rem))] bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden z-40 backdrop-blur-xl"
                    id={menuId}
                    role="menu"
                  >
                    <div className="p-1.5 space-y-1">
                      {modes.map((m) => {
                        const Icon = m.icon;
                        const isActive = mode === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setMode?.(m.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-[colors,opacity,transform] ${
                              isActive
                                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                            role="menuitem"
                            type="button"
                          >
                            <div className="flex items-center gap-3">
                              <Icon
                                className={`w-4 h-4 ${isActive ? "text-cyan-500" : ""}`}
                              />
                              <span className="font-bold text-xs sm:text-sm">
                                {m.label}
                              </span>
                            </div>
                            {isActive && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Suggested Prompt Cards Grid with Framer Motion Stagger */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : {
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08,
                        delayChildren: 0.35,
                      },
                    },
                  }
            }
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full mt-2 sm:mt-4"
          >
            {[
              {
                id: "summarize",
                icon: BookOpen,
                title: t("summarizeSubject"),
                desc: t("summarizeSubjectDesc"),
                prompt: t("summarizeSubject"),
              },
              {
                id: "code",
                icon: Code,
                title: t("explainCode"),
                desc: t("explainCodeDesc"),
                prompt: t("explainCode"),
              },
              {
                id: "plan",
                icon: Calendar,
                title: t("studyPlan"),
                desc: t("studyPlanDesc"),
                prompt: t("studyPlan"),
              },
              {
                id: "whatsapp",
                icon: MessageCircle,
                title: t("whatsappChat"),
                desc: t("whatsappChatDesc"),
                prompt: t("whatsappChat"),
              },
            ].map((item) => (
              <motion.button
                key={item.id}
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.95 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                      type: "spring",
                      stiffness: 350,
                      damping: 25,
                    },
                  },
                }}
                whileHover={shouldReduceMotion ? {} : { scale: 1.03, y: -3 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
                onClick={() => onSuggestionClick?.(item.prompt)}
                className="group relative flex flex-col items-center p-2.5 sm:p-3.5 bg-white/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl transition-colors duration-300 hover:shadow-xl hover:shadow-cyan-500/10 text-center min-h-[85px] sm:min-h-[110px] justify-center focus-visible:ring-2 focus-visible:ring-cyan-500/30 outline-none backdrop-blur-md overflow-hidden"
                type="button"
              >
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 flex items-center justify-center mb-1 sm:mb-1.5 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white mb-0.5 line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2 hidden sm:block">
                  {item.desc}
                </p>
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-cyan-500/30 transition-colors duration-300 pointer-events-none" />
              </motion.button>
            ))}
          </motion.div>

          {/* Puter CTA (visible in initial state as well) */}
          {typeof onOpenPuterSettings === "function" && (
            <motion.div
              variants={
                shouldReduceMotion
                  ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                  : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.55 } } }
              }
              className="w-full flex items-center justify-center mt-1 sm:mt-2"
            >
              <button
                type="button"
                onClick={onOpenPuterSettings}
                className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40 backdrop-blur-md text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                {isPuterSignedIn ? (
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span>{isPuterSignedIn ? t("puterSettings") : t("puterEnable")}</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <>
          {messages.map((message, index) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              onUiMessage={onUiMessage}
              isLatestAssistant={index === lastAssistantIndex}
              isLoading={isLoading}
              mode={mode}
            />
          ))}
          {isLoading && (
            <div
              className={`flex gap-2.5 sm:gap-4 w-[95%] sm:w-auto max-w-[95%] sm:max-w-[88%] md:max-w-[82%] lg:max-w-[75%] ${isRTL ? "justify-end flex-row-reverse" : "justify-start"} animate-in ${isRTL ? "slide-in-from-right-2" : "slide-in-from-left-2"} duration-300`}
            >
              <div
                className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mt-1 bg-transparent"
                aria-hidden="true"
              >
                <LottiePlayer
                  key={mode}
                  src="/animations/ai-robo.lottie"
                  animationId="Main Scene"
                  stateMachineId="StateMachine1"
                  autoplay
                  loop
                  dotLottieRefCallback={handleThinkingLottieRef}
                  className="w-full h-full"
                />
              </div>
              <div
                className={`bg-white dark:bg-slate-800 rounded-2xl ${isRTL ? "rounded-tl-none" : "rounded-tr-none"} px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center`}
              >
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
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
