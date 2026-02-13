"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  MessageSquare,
  Bot,
  User,
  Trash2,
  X,
  Brain,
  Eye,
  EyeOff,
  Lock as LockIcon,
} from "lucide-react";
import { aiAssistant } from "../../lib/gemini";
import { useAnalytics } from "../../hooks/useAnalytics";
import { QuizPlayer } from "../../components/QuizPlayer";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { getSessionId } from "../../lib/session";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuizQuestionInput {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizDataInput {
  title: string;
  description?: string;
  questions: QuizQuestionInput[];
}

// Message limits
const GUEST_MESSAGE_LIMIT = 2;
const REGISTERED_MESSAGE_LIMIT = 5;

function AiAssistantChatPage() {
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTextInput, setQuizTextInput] = useState("");
  const [quizInputMode, setQuizInputMode] = useState<"text" | "json">("text");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const persistTimerRef = useRef<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [loadingMessageCount, setLoadingMessageCount] = useState(true);

  const stats = aiAssistant.getStats();
  const aiStatus = aiAssistant.getAIStatus();
  const hasChatData = stats.totalChunks > 0;

  // Message limits based on user type
  const messageLimit = user ? REGISTERED_MESSAGE_LIMIT : GUEST_MESSAGE_LIMIT;
  const remainingMessages = messageLimit - dailyMessageCount;
  const hasReachedLimit = dailyMessageCount >= messageLimit;

  // Local storage keys
  const CHAT_STORAGE_KEY = "ai_assistant_chat_messages";
  const OLD_CHAT_STORAGE_KEY = "whatsapp_chat_messages";
  const GUEST_COUNT_KEY = "ai_daily_count_guest";

  // Load messages from localStorage on component mount
  useEffect(() => {
    let savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);

    // Fallback to old key if new one doesn't exist
    if (!savedMessages) {
      savedMessages = localStorage.getItem(OLD_CHAT_STORAGE_KEY);
      if (savedMessages) {
        localStorage.setItem(CHAT_STORAGE_KEY, savedMessages);
        // Optional: localStorage.removeItem(OLD_CHAT_STORAGE_KEY);
      }
    }

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsedMessages.map(
          (msg: {
            timestamp: string;
            id: string;
            type: "user" | "assistant";
            content: string;
          }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }),
        );
        setMessages(messagesWithDates);
      } catch {
        // Error loading chat messages from localStorage
      }
    }
  }, []);

  // Load daily message count from server (for registered users) or localStorage (for guests)
  useEffect(() => {
    const loadMessageCount = async () => {
      setLoadingMessageCount(true);

      if (user) {
        // For registered users: count from database
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { count, error } = await supabase
            .from("assistant_messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", today.toISOString());

          if (error) throw error;
          setDailyMessageCount(count || 0);
        } catch {
          setDailyMessageCount(0);
        }
      } else {
        // For guests: use localStorage with session_id
        try {
          const stored = localStorage.getItem(GUEST_COUNT_KEY);
          if (stored) {
            const { count, date } = JSON.parse(stored);
            const today = new Date().toDateString();
            if (date === today) {
              setDailyMessageCount(count);
            } else {
              localStorage.removeItem(GUEST_COUNT_KEY);
              setDailyMessageCount(0);
            }
          }
        } catch {
          // Error loading guest message count
        }
      }

      setLoadingMessageCount(false);
    };

    loadMessageCount();
  }, [user]);

  // Handle scroll to detect if user is near bottom
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 100;
  }, []);

  // Debounced save to localStorage
  const schedulePersist = useCallback((msgs: ChatMessage[]) => {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
      } catch {
        // Error saving chat messages to localStorage
      }
    }, 500);
  }, []);

  // Save messages with debounce + auto-scroll using requestAnimationFrame
  useEffect(() => {
    if (messages.length > 0) {
      schedulePersist(messages);
    }

    // Auto-scroll only if user is near bottom
    if (shouldAutoScrollRef.current) {
      const el = messagesContainerRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [messages, schedulePersist]);

  // Auto-reload data if no data is available
  useEffect(() => {
    const autoReloadData = async () => {
      if (!dataLoaded && stats.totalChunks === 0) {
        try {
          await aiAssistant.loadAllData();
          setDataLoaded(true);
        } catch {
          // فشل في تحميل البيانات تلقائياً
        }
      } else if (stats.totalChunks > 0) {
        setDataLoaded(true);
      }
    };

    autoReloadData();
  }, [dataLoaded, stats.totalChunks]);

  const handleSendMessage = async () => {
    if (
      !inputMessage.trim() ||
      isLoading ||
      hasReachedLimit ||
      loadingMessageCount
    )
      return;

    const startTime = Date.now();

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Update daily message count (optimistic update)
    const newCount = dailyMessageCount + 1;
    setDailyMessageCount(newCount);

    // For guests only: save to localStorage
    if (!user) {
      try {
        localStorage.setItem(
          GUEST_COUNT_KEY,
          JSON.stringify({
            count: newCount,
            date: new Date().toDateString(),
          }),
        );
      } catch {
        // Error saving guest message count
      }
    }

    trackEvent("ai_question_asked", { length: userMessage.content.length });

    try {
      const response = await aiAssistant.generateResponse(userMessage.content);

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        type: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
      trackEvent("ai_response_received", { length: response.length });

      // Save to assistant_messages table for analytics
      try {
        await supabase.from("assistant_messages").insert({
          user_id: user?.id,
          session_id: getSessionId(),
          user_message: userMessage.content,
          assistant_response: response,
          response_time_ms: Date.now() - startTime,
          ai_model_used: "gemini", // Using Gemini model
          metadata: {
            message_length: response.length,
            has_custom_api_key: aiStatus.hasCustomApiKey,
          },
        });
      } catch {
        // Failed to save assistant message
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: "assistant",
        content: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
        timestamp: new Date(),
      };
      setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في مسح سجل المحادثة؟")) {
      setMessages([]);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(OLD_CHAT_STORAGE_KEY);
      trackEvent("ai_chat_cleared");
    }
  };

  // Open quiz modal
  const handleOpenQuizModal = () => {
    setShowQuizModal(true);
    setQuizTextInput("");
    setQuizInputMode("text");
  };

  // Generate quiz from user input
  const handleGenerateQuiz = async () => {
    if (isGeneratingQuiz || !quizTextInput.trim()) return;

    setIsGeneratingQuiz(true);
    trackEvent("ai_quiz_generation_started");

    try {
      let quizData: QuizDataInput;

      if (quizInputMode === "json") {
        // Parse JSON directly
        try {
          quizData = JSON.parse(quizTextInput);
          if (
            !quizData.title ||
            !quizData.questions ||
            !Array.isArray(quizData.questions)
          ) {
            throw new Error(
              "صيغة JSON غير صحيحة. يجب أن يحتوي على title و questions.",
            );
          }
        } catch {
          alert("خطأ في صيغة JSON. تأكد من صحة البيانات.");
          setIsGeneratingQuiz(false);
          return;
        }
      } else {
        // Generate quiz from text using AI
        const response = await aiAssistant.generateQuiz(quizTextInput);
        quizData = response as QuizDataInput;
      }

      const questions = quizData.questions || [];

      // Save quiz to database
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quizData.title,
          description:
            quizData.description || "اختبار مُولّد بالذكاء الاصطناعي",
          user_id: user?.id || null,
          source_type: "ai_generated",
          subject: "AI Generated",
          department: "General",
          year: new Date().getFullYear().toString(),
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Save quiz questions
      if (questions.length > 0) {
        const questionsToInsert = questions.map(
          (q: QuizQuestionInput, index: number) => ({
            quiz_id: quiz.id,
            question: q.question,
            options: q.options,
            correct_answer: q.correctAnswer,
            explanation: q.explanation || null,
            order_index: index,
          }),
        );

        const { error: questionsError } = await supabase
          .from("quiz_questions")
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      setActiveQuizId(quiz.id);
      setShowQuizModal(false);
      setQuizTextInput("");
      trackEvent("ai_quiz_generation_success", { quiz_id: quiz.id });

      const assistantMessage: ChatMessage = {
        id: `assistant_quiz_${Date.now()}`,
        type: "assistant",
        content: `لقد قمت بإنشاء اختبار لك بعنوان: ${quizData.title}. يمكنك البدء في حله الآن!`,
        timestamp: new Date(),
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } catch {
      alert("عذراً، فشل إنشاء الاختبار. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;

    try {
      localStorage.setItem("user_gemini_api_key", apiKeyInput.trim());
      setShowApiKeyModal(false);
      setApiKeyInput("");
      alert("تم حفظ مفتاح API بنجاح! سيتم استخدامه الآن للمحادثة.");
      trackEvent("ai_custom_api_key_saved");
    } catch {
      alert("مفتاح API غير صالح.");
    }
  };

  const handleRemoveApiKey = () => {
    localStorage.removeItem("user_gemini_api_key");
    alert("تم إزالة مفتاح API المخصص. سيتم العودة لاستخدام المفتاح الافتراضي.");
    trackEvent("ai_custom_api_key_removed");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-5xl mx-auto">
      {/* Header */}
      <div className="modern-card p-4 mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              مساعد مسار X
            </h1>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                متصل وجاهز للمساعدة
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all"
            title="إعدادات API"
          >
            <LockIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleClearChat}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="مسح المحادثة"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0 scrollbar-hide">
        <div className="modern-card py-2 px-4 flex items-center gap-2 whitespace-nowrap">
          <Brain className="w-4 h-4 text-brand-blue" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            البيانات: {stats.totalChunks} فقرة
          </span>
        </div>
        <div className="modern-card py-2 px-4 flex items-center gap-2 whitespace-nowrap">
          <MessageSquare className="w-4 h-4 text-brand-orange" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            المواضيع: {stats.totalMessages} رسائل
          </span>
        </div>
        {aiStatus.hasCustomApiKey && (
          <div className="modern-card py-2 px-4 flex items-center gap-2 whitespace-nowrap border-green-200 bg-green-50 dark:bg-green-900/10">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              مفتاح API مخصص نشط
            </span>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 modern-card mb-4 overflow-hidden flex flex-col">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-brand-blue/5 rounded-full flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-brand-blue/30" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                كيف يمكنني مساعدتك اليوم؟
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                يمكنك سؤالي عن أي شيء يخص المواد الدراسية، الملخصات، أو حتى طلب
                إنشاء اختبار تجريبي لك.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-md">
                {[
                  "اشرح لي مفهوم التشفير",
                  "لخص لي أهم نقاط مادة الشبكات",
                  "أنشئ لي اختباراً قصيراً",
                  "كيف أذاكر بفعالية؟",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="p-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-blue/5 hover:text-brand-blue rounded-xl border border-slate-100 dark:border-slate-800 transition-all text-right"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.type === "user" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${
                    msg.type === "user" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      msg.type === "user"
                        ? "bg-brand-blue text-white"
                        : "bg-brand-orange text-white"
                    }`}
                  >
                    {msg.type === "user" ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.type === "user"
                        ? "bg-brand-blue text-white rounded-tr-none"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div
                      className={`text-[10px] mt-2 opacity-50 ${
                        msg.type === "user" ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-end">
              <div className="flex gap-3 max-w-[85%] flex-row-reverse">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-orange text-white flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-orange rounded-full animate-bounce"></span>
                    <span
                      className="w-1.5 h-1.5 bg-brand-orange rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></span>
                    <span
                      className="w-1.5 h-1.5 bg-brand-orange rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {/* Limit reached message */}
          {hasReachedLimit && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0">
                  <LockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-1">
                    {user ? "انتهت رسائلك اليومية" : "انتهت رسائلك المجانية"}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {user
                      ? "لقد استخدمت جميع رسائلك الـ 5 لهذا اليوم. ستتجدد رسائلك غداً تلقائياً."
                      : "يمكنك إرسال رسالتين فقط كزائر. سجّل حساباً للحصول على 5 رسائل يومياً!"}
                  </p>
                  {!user && (
                    <button
                      onClick={() => (window.location.href = "/signup")}
                      className="mt-2 text-sm font-bold text-brand-blue hover:underline"
                    >
                      إنشاء حساب مجاني →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Remaining messages indicator */}
          {!hasReachedLimit && (
            <div className="mb-2 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                الرسائل المتبقية:{" "}
                <span
                  className={`font-bold ${remainingMessages <= 1 ? "text-amber-500" : "text-brand-blue"}`}
                >
                  {remainingMessages}
                </span>{" "}
                من {messageLimit}
              </span>
              {!user && (
                <button
                  onClick={() => (window.location.href = "/signup")}
                  className="text-xs font-bold text-brand-blue hover:underline"
                >
                  سجّل للحصول على المزيد
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleOpenQuizModal}
              disabled={hasReachedLimit}
              className={`p-3 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
                hasReachedLimit
                  ? "bg-slate-100 border-slate-200 text-slate-400"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-brand-orange hover:border-brand-orange/50 hover:bg-brand-orange/5"
              }`}
              title="إنشاء اختبار من نص"
            >
              <Brain className="w-6 h-6" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  hasReachedLimit
                    ? user
                      ? "انتظر حتى الغد لإرسال رسائل جديدة"
                      : "سجّل حساباً للحصول على رسائل إضافية"
                    : hasChatData
                      ? "اسألني أي شيء..."
                      : "جاري تحميل البيانات..."
                }
                disabled={!hasChatData || hasReachedLimit}
                rows={1}
                className="w-full p-3 pr-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all resize-none text-slate-900 dark:text-white custom-scrollbar disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={
                  !inputMessage.trim() ||
                  isLoading ||
                  !hasChatData ||
                  hasReachedLimit
                }
                className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                  !inputMessage.trim() ||
                  isLoading ||
                  !hasChatData ||
                  hasReachedLimit
                    ? "text-slate-300"
                    : "text-brand-blue hover:bg-brand-blue/10"
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            قد يرتكب الذكاء الاصطناعي أخطاء، يرجى التحقق من المعلومات المهمة.
          </p>
        </div>
      </div>

      {/* Quiz Input Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl modern-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                إنشاء اختبار جديد
              </h3>
              <button
                onClick={() => setShowQuizModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setQuizInputMode("text")}
                className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-all ${
                  quizInputMode === "text"
                    ? "bg-brand-blue text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                نص (سيُولّد بالذكاء الاصطناعي)
              </button>
              <button
                onClick={() => setQuizInputMode("json")}
                className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-all ${
                  quizInputMode === "json"
                    ? "bg-brand-blue text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                JSON (جاهز)
              </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400">
              {quizInputMode === "text" ? (
                <p>
                  أدخل النص الذي تريد إنشاء اختبار منه. سيقوم الذكاء الاصطناعي
                  بتحليل النص وتوليد أسئلة تلقائياً.
                </p>
              ) : (
                <div>
                  <p className="mb-2">أدخل بيانات الاختبار بصيغة JSON. مثال:</p>
                  <pre
                    className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded overflow-x-auto"
                    dir="ltr"
                  >
                    {`{
  "title": "عنوان الاختبار",
  "questions": [
    {
      "question": "نص السؤال",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctAnswer": 0,
      "explanation": "شرح الإجابة"
    }
  ]
}`}
                  </pre>
                </div>
              )}
            </div>

            {/* Text Input */}
            <textarea
              value={quizTextInput}
              onChange={(e) => setQuizTextInput(e.target.value)}
              placeholder={
                quizInputMode === "text"
                  ? "الصق النص هنا..."
                  : "الصق JSON هنا..."
              }
              rows={10}
              className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all resize-none text-slate-900 dark:text-white custom-scrollbar mb-4"
              dir={quizInputMode === "json" ? "ltr" : "rtl"}
            />

            {/* Generate Button */}
            <button
              onClick={handleGenerateQuiz}
              disabled={isGeneratingQuiz || !quizTextInput.trim()}
              className="w-full brand-button py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGeneratingQuiz ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري إنشاء الاختبار...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>
                    {quizInputMode === "text"
                      ? "توليد اختبار بالذكاء الاصطناعي"
                      : "إنشاء اختبار من JSON"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quiz Player Modal */}
      {activeQuizId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white">
                الاختبار الذكي
              </h3>
              <button
                onClick={() => setActiveQuizId(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QuizPlayer
                quizId={activeQuizId}
                onComplete={() => {
                  // Optional: track score
                }}
                onClose={() => setActiveQuizId(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md modern-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                إعدادات مفتاح API
              </h3>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              يمكنك استخدام مفتاح API الخاص بك من Google AI Studio (Gemini)
              للحصول على أداء أسرع وحدود استخدام أعلى.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="أدخل مفتاح Gemini API هنا..."
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="brand-button py-3 disabled:opacity-50"
                >
                  حفظ المفتاح
                </button>

                {aiStatus.hasCustomApiKey && (
                  <button
                    onClick={handleRemoveApiKey}
                    className="py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    إزالة المفتاح المخصص
                  </button>
                )}
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-brand-blue hover:underline"
              >
                كيف أحصل على مفتاح API؟
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiAssistantChatPage;
