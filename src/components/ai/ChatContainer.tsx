import { useEffect, useState, type RefObject } from "react";
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
import { NeuralEnergyEntity } from "./NeuralEnergyEntity";

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
}: ChatContainerProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const menuId = "chat-initial-mode-menu";
  const locale = useLocale();
  const isRTL = locale === "ar";

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
      className={`flex-1 overflow-y-auto p-4 sm:p-6 pb-8 sm:pb-12 space-y-4 sm:space-y-6 scroll-smooth chat-messages transition-[background-color,border-color] duration-500 ${
        isInitialState
          ? "flex flex-col items-center justify-center !overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 pb-32 sm:pb-24"
          : "scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
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
                      staggerChildren: 0.15,
                      delayChildren: 0.2,
                    },
                  },
                }
          }
          className="flex flex-col items-center justify-center h-full text-center space-y-12 sm:space-y-16 max-w-2xl px-4 overflow-visible"
        >
          {/* Neural Network Energy Entity (Integrated) */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }
            }
            className="w-full flex items-center justify-center overflow-visible"
          >
            {!shouldReduceMotion && <NeuralEnergyEntity className="scale-[0.6] sm:scale-100 -my-8 sm:my-0" />}
          </motion.div>

          {/* Title with Zane Ice Gradient */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }
            }
            className="space-y-3 sm:space-y-4"
          >
            <h2
              className="text-3xl sm:text-5xl font-black tracking-tight text-sky-500 dark:text-sky-400"
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
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden z-40 backdrop-blur-xl"
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

          {/* Suggested Prompt Cards Grid */}
          <motion.div
            variants={
              shouldReduceMotion
                ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
                : {
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { delay: 0.4, staggerChildren: 0.1 },
                    },
                  }
            }
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full mt-6 sm:mt-8"
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
              <button
                key={item.id}
                onClick={() => onSuggestionClick?.(item.prompt)}
                className="group relative flex flex-col items-center p-3 sm:p-4 bg-white/5 hover:bg-white/10 dark:bg-slate-800/20 dark:hover:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl transition-[colors,transform,box-shadow,border-color] duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/5 text-center min-h-[110px] sm:min-h-[130px] justify-center focus-visible:ring-2 focus-visible:ring-cyan-500/30 outline-none"
                type="button"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2 hidden sm:block">
                  {item.desc}
                </p>
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-cyan-500/20 transition-colors duration-300 pointer-events-none" />
              </button>
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
              className="w-full flex items-center justify-center"
            >
              <button
                type="button"
                onClick={onOpenPuterSettings}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40 backdrop-blur-md text-slate-800 dark:text-slate-100 font-extrabold shadow-sm hover:shadow-md transition-shadow transition-transform active:scale-[0.98]"
              >
                {isPuterSignedIn ? (
                  <Settings className="w-4 h-4" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{isPuterSignedIn ? t("puterSettings") : t("puterEnable")}</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <>
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              onUiMessage={onUiMessage}
            />
          ))}
          {isLoading && (
            <div
              className={`flex ${isRTL ? "justify-end" : "justify-start"} animate-in ${isRTL ? "slide-in-from-right-2" : "slide-in-from-left-2"} duration-300`}
            >
              <div
                className={`bg-white dark:bg-slate-800 rounded-2xl ${isRTL ? "rounded-tl-none" : "rounded-tr-none"} px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700`}
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
