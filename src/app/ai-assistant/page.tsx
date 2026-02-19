"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Send,
  MessageSquare,
  Bot,
  Trash2,
  X,
  Brain,
  Lock as LockIcon,
  FileText,
} from "lucide-react";
import { aiAssistant } from "@/lib/ai-assistant";
import { ChatMessageItem } from "@/components/ai/ChatMessageItem";
import { useAnalytics } from "@/hooks/useAnalytics";
import { QuizPlayer } from "@/components/QuizPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { AiAssistantMode } from "@/lib/ai-assistant";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import type { DepartmentOption } from "@/hooks/useAcademicOptions";
import dynamic from "next/dynamic";

import { useSubjects } from "@/hooks/useSubjects";

const PuterSettingsModal = dynamic(
  () => import("@/components/ai/PuterSettingsModal"),
  { ssr: false },
);

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

interface LocalGeneratedQuiz {
  localId: string;
  createdAt: string;
  data: QuizDataInput;
}

import { useAiChat } from "@/hooks/useAiChat";

function AiAssistantChatPage() {
  const { user, loading } = useAuth();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions({
    includeInactive: true,
  });
  const { trackEvent } = useAnalytics();
  const {
    messages,
    isLoading,
    remainingMessages,
    hasReachedLimit,
    sendMessage,
    clearChat,
    setMessages,
    messageLimit,
    isPuterSignedIn,
    mode,
    setMode,
  } = useAiChat(user, trackEvent);

  const [inputMessage, setInputMessage] = useState("");
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTextInput, setQuizTextInput] = useState("");
  const [quizInputMode, setQuizInputMode] = useState<"text" | "json">("text");
  const [generatedQuiz, setGeneratedQuiz] = useState<LocalGeneratedQuiz | null>(
    null,
  );
  const [localGeneratedQuizzes, setLocalGeneratedQuizzes] = useState<
    LocalGeneratedQuiz[]
  >([]);
  const [showLocalQuizModal, setShowLocalQuizModal] = useState(false);
  const [localQuizIndex, setLocalQuizIndex] = useState(0);
  const [localSelectedOption, setLocalSelectedOption] = useState<number | null>(
    null,
  );
  const [localAnswered, setLocalAnswered] = useState(false);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [showPuterModal, setShowPuterModal] = useState(false);
  const [showSubmitForReviewModal, setShowSubmitForReviewModal] =
    useState(false);
  const [submitAcademicLevel, setSubmitAcademicLevel] = useState<string>("");
  const [submitSemester, setSubmitSemester] = useState<number>(1);
  const [submitDepartment, setSubmitDepartment] = useState<string>("");
  const [submitSubject, setSubmitSubject] = useState<string>("");

  const selectedSubmitLevelNumber = useMemo(() => {
    if (!submitAcademicLevel) return null;
    const found = levels.find((l) => l.name === submitAcademicLevel);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [levels, submitAcademicLevel]);

  const { subjects: submitSubjects } = useSubjects({
    level: selectedSubmitLevelNumber,
    semester: typeof submitSemester === "number" ? submitSemester : null,
  });
  const availableSubmitDepartments = useMemo<DepartmentOption[]>(() => {
    if (!submitAcademicLevel) return [];
    return getDepartmentsForLevelName(submitAcademicLevel);
  }, [getDepartmentsForLevelName, submitAcademicLevel]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const toggleMode = useCallback(() => {
    setMode((prev: AiAssistantMode) =>
      prev === "group_rag" ? "cs_assistant" : "group_rag",
    );
  }, [setMode]);

  // Constants for reusability and cleaner code
  const SUGGESTIONS = [
    "اشرح لي مفهوم التشفير",
    "لخص لي أهم نقاط مادة الشبكات",
    "أنشئ لي اختباراً قصيراً",
    "كيف أذاكر بفعالية؟",
  ];

  // Helper function to scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // Access stats via useEffect/state to prevent hydration mismatch if methods use window
  const [stats, setStats] = useState({ totalChunks: 0, totalMessages: 0 });

  useEffect(() => {
    // Initial stats load
    setStats(aiAssistant.getStats());
  }, []);

  // We use isPuterSignedIn from the hook instead of direct access
  // const aiStatus = aiAssistant.getPuterStatus(); // Caused hydration mismatch
  const hasChatData = stats.totalChunks > 0;

  // Auto-reload data if no data is available
  useEffect(() => {
    const autoReloadData = async () => {
      // Refresh stats
      const currentStats = aiAssistant.getStats();
      setStats(currentStats);

      if (!dataLoaded && currentStats.totalChunks === 0) {
        try {
          await aiAssistant.loadAllData();
          setDataLoaded(true);
          setStats(aiAssistant.getStats());
        } catch {
          // فشل في تحميل البيانات تلقائياً
        }
      } else if (currentStats.totalChunks > 0) {
        setDataLoaded(true);
      }
    };

    autoReloadData();
  }, [dataLoaded]);

  // Handle auto-scroll when messages change
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    await sendMessage(inputMessage);
    setInputMessage("");
  };

  const handleClearChat = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في مسح سجل المحادثة؟")) {
      clearChat();
      trackEvent("ai_chat_cleared");
    }
  };

  const handleSummarizeChat = async () => {
    if (isSummarizing) return;

    setIsSummarizing(true);
    trackEvent("ai_chat_summary_started");

    try {
      const result = await aiAssistant.summarizeLoadedData();
      setSummaryResult(result);
      setShowSummaryModal(true);
      trackEvent("ai_chat_summary_success");
    } catch (error) {
      console.error(error);
      alert("فشل في إنشاء ملخص. تأكد من تحميل بيانات المحادثة أولاً.");
    } finally {
      setIsSummarizing(false);
    }
  };
  const handleOpenQuizModal = () => {
    setShowQuizModal(true);
    setQuizTextInput("");
    setQuizInputMode("text");
  };

  const LOCAL_AI_QUIZZES_KEY = "local_ai_generated_quizzes";

  const readLocalQuizzes = useCallback((): LocalGeneratedQuiz[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_AI_QUIZZES_KEY);
      const arr: LocalGeneratedQuiz[] = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, []);

  const persistLocalQuiz = useCallback((quiz: LocalGeneratedQuiz) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_AI_QUIZZES_KEY);
      const arr: LocalGeneratedQuiz[] = raw ? JSON.parse(raw) : [];
      const next = [quiz, ...arr].slice(0, 20);
      localStorage.setItem(LOCAL_AI_QUIZZES_KEY, JSON.stringify(next));
      setLocalGeneratedQuizzes(next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const arr = readLocalQuizzes();
    setLocalGeneratedQuizzes(arr);
    setGeneratedQuiz((prev) => prev || arr[0] || null);
  }, [readLocalQuizzes]);

  const resetLocalQuizPlayer = useCallback(() => {
    setLocalQuizIndex(0);
    setLocalSelectedOption(null);
    setLocalAnswered(false);
  }, []);

  const handleOpenLocalQuiz = useCallback(() => {
    if (!generatedQuiz) return;
    resetLocalQuizPlayer();
    setShowLocalQuizModal(true);
  }, [generatedQuiz, resetLocalQuizPlayer]);

  const handleSubmitQuizForReview = useCallback(async () => {
    if (!user || !generatedQuiz || isSubmittingQuiz) return;
    if (!submitAcademicLevel || !submitDepartment || !submitSubject) {
      alert("من فضلك اختر الصف/المستوى والقسم والمادة قبل الإرسال.");
      return;
    }

    setIsSubmittingQuiz(true);
    trackEvent("ai_quiz_submit_for_review_started");

    try {
      const quizData = generatedQuiz.data;

      const submitterName =
        (user.user_metadata as any)?.display_name ||
        (user.user_metadata as any)?.name ||
        user.email?.split("@")[0] ||
        "مستخدم";

      const descriptionJson = {
        description: quizData.description || "اختبار مُولّد بالذكاء الاصطناعي",
        submitted_by: user.email,
        submitted_by_name: submitterName,
        submitted_at: new Date().toISOString(),
        source: "ai_assistant",
        academic_level: submitAcademicLevel,
        semester: submitSemester,
        department: submitDepartment,
        subject: submitSubject,
      };

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quizData.title,
          description: JSON.stringify(descriptionJson),
          user_id: user.id,
          source_type: "ai_generated",
          subject: submitSubject,
          department: submitDepartment,
          year: submitAcademicLevel,
          status: "pending",
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questions = quizData.questions || [];
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

      const assistantMessage: ChatMessage = {
        id: `assistant_submit_${Date.now()}`,
        type: "assistant",
        content:
          "تم إرسال الامتحان للمراجعة بنجاح. سيتم نشره للعامة بعد اعتماده من الأدمن.",
        timestamp: new Date(),
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);

      setShowSubmitForReviewModal(false);

      trackEvent("ai_quiz_submit_for_review_success", { quiz_id: quiz.id });
    } catch (e) {
      console.error(e);
      trackEvent("ai_quiz_submit_for_review_failed");
      alert("عذراً، فشل إرسال الامتحان للمراجعة. حاول مرة أخرى.");
    } finally {
      setIsSubmittingQuiz(false);
    }
  }, [generatedQuiz, isSubmittingQuiz, setMessages, trackEvent, user]);

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

      const localQuiz: LocalGeneratedQuiz = {
        localId: `local_${Date.now()}`,
        createdAt: new Date().toISOString(),
        data: {
          title: quizData.title,
          description: quizData.description,
          questions,
        },
      };

      setGeneratedQuiz(localQuiz);
      persistLocalQuiz(localQuiz);

      setShowQuizModal(false);
      setQuizTextInput("");
      trackEvent("ai_quiz_generation_success", { local_id: localQuiz.localId });

      const assistantMessage: ChatMessage = {
        id: `assistant_quiz_${Date.now()}`,
        type: "assistant",
        content: `لقد قمت بإنشاء اختبار لك بعنوان: ${quizData.title}. يمكنك فتحه وحله محلياً الآن.${user ? " ويمكنك أيضاً إرساله للمراجعة والنشر." : ""}`,
        timestamp: new Date(),
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } catch {
      alert("عذراً، فشل إنشاء الاختبار. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex flex-col h-[calc(100dvh-88px)] sm:h-[calc(100vh-120px)] max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="modern-card p-3 sm:p-4 mb-2 sm:mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-brand-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {mode === "group_rag"
                ? "مساعد مسار X"
                : "مساعد برمجي (حاسبات ومعلومات)"}
            </h1>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "group_rag"
                  ? "وضع محادثات المجموعة (إجابات من البيانات)"
                  : "وضع المساعد البرمجي (إجابات عامة + أمثلة وكود)"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            className="px-3 py-2 text-xs font-bold rounded-lg transition-all border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue/50 hover:text-brand-blue"
            title={
              mode === "group_rag"
                ? "التبديل إلى المساعد البرمجي"
                : "التبديل إلى محادثات المجموعة"
            }
          >
            <span className="sm:hidden">تبديل الوضع</span>
            <span className="hidden sm:inline">
              {mode === "group_rag" ? "مساعد برمجي" : "محادثات المجموعة"}
            </span>
          </button>
          <button
            onClick={() => setShowPuterModal(true)}
            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all"
            title="إعدادات Puter"
          >
            <LockIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleSummarizeChat}
            disabled={isSummarizing || !hasChatData}
            className={`p-2 rounded-lg transition-all ${
              isSummarizing || !hasChatData
                ? "text-slate-300"
                : "text-slate-400 hover:text-purple-600 hover:bg-purple-50"
            }`}
            title="تلخيص المحادثة (آخر 100 رسالة)"
          >
            {isSummarizing ? (
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FileText className="w-5 h-5" />
            )}
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

      {generatedQuiz && (
        <div className="modern-card p-3 sm:p-4 mb-2 sm:mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              آخر اختبار مولّد: {generatedQuiz.data.title}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {user
                ? "يمكنك حلّه محلياً أو إرساله للمراجعة والنشر (سيظهر للإدارة باسمك)."
                : "كزائر: يمكنك حلّه محلياً. لإرساله للمراجعة والنشر يجب تسجيل الدخول."}
            </div>
            {localGeneratedQuizzes.length > 1 && (
              <div className="mt-3">
                <select
                  value={generatedQuiz.localId}
                  onChange={(e) => {
                    const next = localGeneratedQuizzes.find(
                      (q) => q.localId === e.target.value,
                    );
                    if (!next) return;
                    setGeneratedQuiz(next);
                    resetLocalQuizPlayer();
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
                >
                  {localGeneratedQuizzes.map((q) => (
                    <option key={q.localId} value={q.localId}>
                      {q.data.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenLocalQuiz}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm font-semibold"
            >
              فتح الاختبار
            </button>
            {user && (
              <button
                onClick={() => {
                  setShowSubmitForReviewModal(true);
                  setSubmitAcademicLevel(
                    (prev) => prev || levels[0]?.name || "",
                  );
                  setSubmitSemester(1);
                  setSubmitDepartment((prev) => prev || "");
                  setSubmitSubject((prev) => prev || "");
                }}
                disabled={isSubmittingQuiz}
                className="px-4 py-2 rounded-xl bg-brand-blue text-white hover:opacity-90 transition-all text-sm font-semibold disabled:opacity-50"
                title="سيتم إرسال الامتحان للمراجعة. سيتم ربطه بهويتك (user_id)"
              >
                {isSubmittingQuiz ? "جاري الإرسال..." : "إرسال للمراجعة والنشر"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submit For Review Modal */}
      {showSubmitForReviewModal && generatedQuiz && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg modern-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                إرسال الامتحان للمراجعة
              </h3>
              <button
                onClick={() => setShowSubmitForReviewModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                اختر بيانات الامتحان قبل الإرسال (ستظهر للإدارة مع الامتحان).
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  الصف / المستوى
                </label>
                <select
                  value={submitAcademicLevel}
                  onChange={(e) => {
                    setSubmitAcademicLevel(e.target.value);
                    setSubmitSemester(1);
                    setSubmitDepartment("");
                    setSubmitSubject("");
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
                >
                  <option value="" disabled>
                    اختر المستوى...
                  </option>
                  {levels.map((lvl) => (
                    <option
                      key={lvl.id}
                      value={lvl.name}
                      disabled={!lvl.is_active}
                    >
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  الترم
                </label>
                <select
                  value={submitSemester}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setSubmitSemester(next);
                    setSubmitSubject("");
                  }}
                  disabled={!submitAcademicLevel}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm disabled:opacity-60"
                >
                  <option value={1}>ترم 1</option>
                  <option value={2}>ترم 2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  القسم
                </label>
                <select
                  value={submitDepartment}
                  onChange={(e) => setSubmitDepartment(e.target.value)}
                  disabled={
                    !submitAcademicLevel ||
                    availableSubmitDepartments.length === 0
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
                >
                  <option value="" disabled>
                    اختر القسم...
                  </option>
                  {availableSubmitDepartments.map((dep) => (
                    <option
                      key={dep.id}
                      value={dep.name}
                      disabled={!dep.is_active}
                    >
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  المادة
                </label>
                <select
                  value={submitSubject}
                  onChange={(e) => setSubmitSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
                >
                  <option value="" disabled>
                    اختر المادة...
                  </option>
                  {submitSubjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowSubmitForReviewModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitQuizForReview}
                disabled={
                  isSubmittingQuiz ||
                  !submitAcademicLevel ||
                  !submitDepartment ||
                  !submitSubject
                }
                className="flex-1 px-4 py-2 rounded-xl bg-brand-blue text-white hover:opacity-90 transition-all text-sm font-semibold disabled:opacity-50"
              >
                {isSubmittingQuiz ? "جاري الإرسال..." : "تأكيد الإرسال"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex gap-2 mb-2 sm:mb-4 overflow-x-auto pb-2 shrink-0 scrollbar-hide">
        <div className="modern-card py-1.5 sm:py-2 px-3 sm:px-4 flex items-center gap-2 whitespace-nowrap">
          <Brain className="w-4 h-4 text-brand-blue" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            البيانات: {stats.totalChunks} فقرة
          </span>
        </div>
        <div className="modern-card py-1.5 sm:py-2 px-3 sm:px-4 flex items-center gap-2 whitespace-nowrap">
          <MessageSquare className="w-4 h-4 text-brand-orange" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            المواضيع: {stats.totalMessages} رسائل
          </span>
        </div>
        {isPuterSignedIn && (
          <div className="modern-card py-1.5 sm:py-2 px-3 sm:px-4 flex items-center gap-2 whitespace-nowrap border-green-200 bg-green-50 dark:bg-green-900/10">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              متصل بـ Puter
            </span>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 modern-card mb-2 sm:mb-4 overflow-hidden flex flex-col">
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6 custom-scrollbar"
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
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="p-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand-blue/5 hover:text-brand-blue rounded-xl border border-slate-100 dark:border-slate-800 transition-all text-right"
                    dir="auto"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
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
        <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {/* Limit reached message */}
          {!loading && hasReachedLimit && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0">
                  <LockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-1">
                    {isPuterSignedIn
                      ? "غير محدود (Puter)"
                      : user
                        ? "انتهت رسائلك اليومية"
                        : "انتهت رسائلك المجانية"}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {isPuterSignedIn
                      ? "يمكنك المتابعة باستخدام رصيد Puter الخاص بك."
                      : user
                        ? "لقد استخدمت جميع رسائلك الـ 5 لهذا اليوم. سجّل الدخول عبر Puter للمتابعة باستخدام رصيدك."
                        : "يمكنك إرسال رسالتين فقط كزائر. سجّل حساباً أو استخدم Puter للمتابعة."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {!isPuterSignedIn && (
                      <button
                        onClick={() => setShowPuterModal(true)}
                        className="text-sm font-bold text-brand-blue hover:underline"
                      >
                        تسجيل الدخول عبر Puter →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Remaining messages indicator */}
          {!hasReachedLimit && !user && (
            <div className="mb-2 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                الرسائل المتبقية:{" "}
                <span
                  className={`font-bold ${!isPuterSignedIn && remainingMessages <= 1 ? "text-amber-500" : "text-brand-blue"}`}
                >
                  {isPuterSignedIn
                    ? "غير محدود (Puter)"
                    : `${remainingMessages} من ${messageLimit}`}
                </span>
              </span>
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

            <div className="flex-1 flex items-center gap-2">
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
                    : "اسألني أي شيء..."
                }
                disabled={hasReachedLimit}
                rows={1}
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all resize-none text-slate-900 dark:text-white custom-scrollbar disabled:opacity-50 min-h-[48px] leading-6"
                dir="auto"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || hasReachedLimit}
                className={`h-12 w-12 grid place-items-center rounded-xl transition-all shrink-0 border ${
                  !inputMessage.trim() || isLoading || hasReachedLimit
                    ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-slate-950 text-cyan-300 border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_24px_rgba(34,211,238,0.35)] hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_34px_rgba(34,211,238,0.55)] hover:border-cyan-300/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2 hidden sm:block">
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

      {/* Local Quiz Modal */}
      {showLocalQuizModal && generatedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {generatedQuiz.data.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  وضع محلي
                </p>
              </div>
              <button
                onClick={() => setShowLocalQuizModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {generatedQuiz.data.questions.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 p-8">
                  لا توجد أسئلة في هذا الاختبار.
                </div>
              ) : (
                (() => {
                  const q = generatedQuiz.data.questions[localQuizIndex];
                  const correct = q.correctAnswer;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          سؤال {localQuizIndex + 1} من{" "}
                          {generatedQuiz.data.questions.length}
                        </span>
                        <button
                          onClick={() => {
                            resetLocalQuizPlayer();
                          }}
                          className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                          إعادة من البداية
                        </button>
                      </div>

                      <div className="modern-card p-4">
                        <div
                          dir="auto"
                          className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed text-start"
                        >
                          {q.question}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, idx) => {
                          const isSelected = localSelectedOption === idx;
                          const isCorrect = idx === correct;
                          const showCorrectness = localAnswered;

                          let cls =
                            "w-full text-start p-5 rounded-2xl border-2 transition-all duration-300 relative group bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700";
                          if (isSelected) {
                            cls +=
                              " border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-indigo-500/10 ring-4 ring-indigo-500/10";
                          } else {
                            cls +=
                              " hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:translate-x-[-4px]";
                          }
                          if (showCorrectness && isCorrect) {
                            cls +=
                              " border-green-400 bg-green-50 dark:bg-green-900/10";
                          }
                          if (showCorrectness && isSelected && !isCorrect) {
                            cls +=
                              " border-red-400 bg-red-50 dark:bg-red-900/10";
                          }

                          return (
                            <button
                              key={idx}
                              disabled={localAnswered}
                              onClick={() => {
                                setLocalSelectedOption(idx);
                              }}
                              className={cls}
                              dir="auto"
                            >
                              <div className="text-sm text-slate-800 dark:text-slate-200 text-start">
                                {opt}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            if (localQuizIndex === 0) return;
                            setLocalQuizIndex((prev) => Math.max(0, prev - 1));
                            setLocalSelectedOption(null);
                            setLocalAnswered(false);
                          }}
                          disabled={localQuizIndex === 0}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm font-semibold disabled:opacity-50"
                        >
                          السابق
                        </button>

                        {!localAnswered ? (
                          <button
                            onClick={() => {
                              if (localSelectedOption === null) return;
                              setLocalAnswered(true);
                            }}
                            disabled={localSelectedOption === null}
                            className="px-4 py-2 rounded-xl bg-brand-blue text-white hover:opacity-90 transition-all text-sm font-semibold disabled:opacity-50"
                          >
                            تحقق
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (
                                localQuizIndex >=
                                generatedQuiz.data.questions.length - 1
                              )
                                return;
                              setLocalQuizIndex((prev) =>
                                Math.min(
                                  generatedQuiz.data.questions.length - 1,
                                  prev + 1,
                                ),
                              );
                              setLocalSelectedOption(null);
                              setLocalAnswered(false);
                            }}
                            disabled={
                              localQuizIndex >=
                              generatedQuiz.data.questions.length - 1
                            }
                            className="px-4 py-2 rounded-xl bg-brand-orange text-white hover:opacity-90 transition-all text-sm font-semibold disabled:opacity-50"
                          >
                            التالي
                          </button>
                        )}
                      </div>

                      {localAnswered && (
                        <div className="modern-card p-4 border border-slate-200 dark:border-slate-700">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {localSelectedOption === correct
                              ? "إجابة صحيحة"
                              : "إجابة خاطئة"}
                          </div>
                          {q.explanation && (
                            <div
                              dir="auto"
                              className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-start"
                            >
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && summaryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl modern-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  ملخص المحادثة
                </h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-brand-blue" />
                  الملخص العام
                </h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
                  {summaryResult.summary}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-brand-orange" />
                  النقاط والرسائل المهمة
                </h4>
                <div className="space-y-3">
                  {summaryResult.important_messages?.map(
                    (msg: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-md">
                            {msg.sender_name}
                          </span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-medium mb-2">
                          {msg.content}
                        </p>
                        {msg.context && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="font-semibold">السياق:</span>{" "}
                            {msg.context}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-medium"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Puter Settings Modal */}
      <PuterSettingsModal
        isOpen={showPuterModal}
        onClose={() => setShowPuterModal(false)}
      />
    </div>
  );
}

export default AiAssistantChatPage;
