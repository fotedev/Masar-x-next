import React, { useState } from "react";
import { useLocale } from "next-intl";
import { Bot, Brain, MessagesSquare, ChevronDown, Check, type LucideIcon } from "lucide-react";
import { ChatMessageItem } from "./ChatMessageItem";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import { motion, AnimatePresence } from "framer-motion";
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
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  t: (key: string) => string;
  isInitialState?: boolean;
  mode?: AiAssistantMode;
  setMode?: (mode: AiAssistantMode) => void;
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
}: ChatContainerProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const locale = useLocale();
  const isRTL = locale === "ar";

  const modes: { id: AiAssistantMode; icon: LucideIcon; label: string }[] = [
    { id: "cs_assistant", icon: Bot, label: t("assistantProgramming") },
    { id: "student_agent", icon: Brain, label: t("assistantStudent") },
    { id: "group_rag", icon: MessagesSquare, label: t("assistantGroupChat") },
  ];

  const currentMode = modes.find((m) => m.id === mode) || modes[0];

  return (
    <div
      ref={messagesContainerRef}
      className={`flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 scroll-smooth transition-all duration-500 ${
        isInitialState 
          ? "flex flex-col items-center justify-center !overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4" 
          : "scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      }`}
    >
      {messages.length === 0 ? (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2
              }
            }
          }}
          className="flex flex-col items-center justify-center h-full text-center space-y-12 sm:space-y-16 max-w-2xl px-4 overflow-visible"
        >
          {/* Neural Network Energy Entity (Integrated) */}
          <motion.div 
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 }
            }}
            className="w-full flex items-center justify-center overflow-visible"
          >
            <NeuralEnergyEntity className="scale-[0.7] sm:scale-100" />
          </motion.div>
          
          {/* Title with Zane Ice Gradient */}
          <motion.div 
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 }
            }}
            className="space-y-3 sm:space-y-4"
          >
            <h2 
              className="text-3xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 drop-shadow-sm"
              dir="auto"
            >
              {t("welcomeTitle")}
            </h2>
          </motion.div>

          {/* Refined Dropdown with Cyan Inset/Border Glow */}
          <motion.div 
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 }
            }}
            className="relative mt-2"
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800/50 rounded-2xl border-2 transition-all duration-300 group min-w-[220px] justify-between shadow-sm backdrop-blur-sm ${
                isDropdownOpen 
                  ? "border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]" 
                  : "border-slate-200 dark:border-slate-700/50 hover:border-cyan-400/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <currentMode.icon className={`w-5 h-5 transition-colors duration-300 ${isDropdownOpen ? "text-cyan-500" : "text-cyan-500"}`} />
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{currentMode.label}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180 text-cyan-500" : ""}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-white/90 dark:bg-slate-800/90 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden z-40 backdrop-blur-md"
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
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                              isActive
                                ? "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-4 h-4 ${isActive ? "text-cyan-500" : ""}`} />
                              <span className="font-bold text-xs sm:text-sm">{m.label}</span>
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
        </motion.div>
      ) : (
        <>
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className={`flex ${isRTL ? "justify-end" : "justify-start"} animate-in ${isRTL ? "slide-in-from-right-2" : "slide-in-from-left-2"} duration-300`}>
              <div className={`bg-white dark:bg-slate-800 rounded-2xl ${isRTL ? "rounded-tl-none" : "rounded-tr-none"} px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700`}>
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
