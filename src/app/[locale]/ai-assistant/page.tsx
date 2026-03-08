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
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirmToast";
import { quizService } from "@/lib/quiz";

import { useSubjects } from "@/hooks/useSubjects";
import { useUserAcademic } from "@/hooks/useUserAcademic";

const PuterSettingsModal = dynamic(
  () => import("@/components/ai/PuterSettingsModal").then((mod) => mod.default),
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

type SupabaseDraftRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

import { useTranslations } from "next-intl";
import { useAiChat } from "@/hooks/useAiChat";

function AiAssistantChatPage() {
  const { user, loading } = useAuth();
  const { levels, getDepartmentsForLevelName, optionsLoading } =
    useAcademicOptions({
      includeInactive: true,
    });
  const { trackEvent } = useAnalytics();
  const t = useTranslations("assistant");
  const {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    setMessages,
    isPuterSignedIn,
    mode,
    setMode,
    isReady,
    studentSelectedSubject,
    setStudentSelectedSubject,
  } = useAiChat(user, trackEvent);

  const { academic } = useUserAcademic();

  const [studentQuizzes, setStudentQuizzes] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [studentQuizzesLoading, setStudentQuizzesLoading] = useState(false);
  const [studentSelectedQuizId, setStudentSelectedQuizId] =
    useState<string>("");

  useEffect(() => {
    const loadStudentQuizzes = async () => {
      if (mode !== "student_agent") return;
      if (!studentSelectedSubject) {
        setStudentQuizzes([]);
        setStudentSelectedQuizId("");
        return;
      }

      try {
        setStudentQuizzesLoading(true);

        const { data, error } = await supabase
          .from("quizzes")
          .select("id,title")
          .eq("status", "approved")
          .eq("subject", studentSelectedSubject)
          .order("title", { ascending: true })
          .limit(50);

        if (error) throw error;

        const items = (data || []) as Array<{ id: string; title: string }>;
        setStudentQuizzes(items);
        if (items.length === 0) {
          setStudentSelectedQuizId("");
        } else if (!items.some((x) => x.id === studentSelectedQuizId)) {
          setStudentSelectedQuizId(items[0].id);
        }
      } catch {
        setStudentQuizzes([]);
        setStudentSelectedQuizId("");
      } finally {
        setStudentQuizzesLoading(false);
      }
    };

    loadStudentQuizzes();
  }, [
    mode,
    studentSelectedSubject,
    academic.level,
    academic.semester,
    studentSelectedQuizId,
  ]);

  const safeMessages = useMemo(() => {
    return Array.isArray(messages) ? messages : [];
  }, [messages]);

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

  const safeLocalGeneratedQuizzes = useMemo(() => {
    return Array.isArray(localGeneratedQuizzes) ? localGeneratedQuizzes : [];
  }, [localGeneratedQuizzes]);
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
  const [showGeneratedQuizModal, setShowGeneratedQuizModal] = useState(false);
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

  const { subjects: studentSubjects } = useSubjects({
    level:
      typeof academic.level === "number"
        ? academic.level
        : selectedSubmitLevelNumber,
    semester:
      typeof academic.semester === "number"
        ? academic.semester
        : typeof submitSemester === "number"
          ? submitSemester
          : null,
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
    setMode((prev: AiAssistantMode) => {
      if (prev === "group_rag") return "cs_assistant";
      if (prev === "cs_assistant") return "student_agent";
      return "group_rag";
    });
  }, [setMode]);

  // Constants for reusability and cleaner code
  const SUGGESTIONS = [
    t("suggestion1"),
    t("suggestion2"),
    t("suggestion3"),
    t("suggestion4"),
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

  const [hasSynced, setHasSynced] = useState(false);

  // Parse Supabase Draft Row helper
  const parseSupabaseDraftRow = useCallback(
    (row: SupabaseDraftRow): LocalGeneratedQuiz | null => {
      try {
        const rawDesc = row.description || "";
        const parsed = rawDesc ? JSON.parse(rawDesc) : null;
        const data = parsed?.data;
        if (!data || typeof data !== "object") return null;
        if (typeof data.title !== "string" || !Array.isArray(data.questions))
          return null;
        return {
          localId: row.id,
          createdAt: row.created_at,
          data: data as QuizDataInput,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const loadSupabaseDrafts = useCallback(async () => {
    if (!user) return;
    try {
      const rows = (await quizService.getAiGeneratedDraftsForUser(
        user.id,
        20,
      )) as unknown as SupabaseDraftRow[];

      const parsed = rows
        .map((r) => parseSupabaseDraftRow(r))
        .filter(Boolean) as LocalGeneratedQuiz[];

      setLocalGeneratedQuizzes(parsed);
      setGeneratedQuiz((prev) => prev || parsed[0] || null);
    } catch {
      // ignore
    }
  }, [parseSupabaseDraftRow, user]);

  const readLocalQuizzes = useCallback((): LocalGeneratedQuiz[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("local_ai_generated_quizzes");
      const arr: LocalGeneratedQuiz[] = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, []);

  // Sync mechanism: local to cloud (one-time upon login)
  useEffect(() => {
    if (user && !loading && !hasSynced) {
      const syncDrafts = async () => {
        const localItems = readLocalQuizzes();
        if (localItems && localItems.length > 0) {
          try {
            const { count } = await quizService.syncLocalQuizzes(
              user.id,
              localItems,
            );
            if (count > 0) {
              toast.success(
                `تمت مزامنة ${count} اختبارات من جهازك إلى حسابك بنجاح.`,
              );
              // Clear local storage after successful sync to maintain single source of truth
              localStorage.removeItem(LOCAL_AI_QUIZZES_KEY);
            }
            setHasSynced(true);
            loadSupabaseDrafts();
          } catch (error) {
            console.error("Sync failed:", error);
          }
        } else {
          setHasSynced(true);
        }
      };
      syncDrafts();
    }
  }, [user, loading, hasSynced, readLocalQuizzes, loadSupabaseDrafts]);

  // Handle auto-scroll when messages change
  useEffect(() => {
    scrollToBottom(true);
  }, [safeMessages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    await sendMessage(inputMessage);
    setInputMessage("");
  };

  const handleClearChat = () => {
    confirmToast("هل أنت متأكد من رغبتك في مسح سجل المحادثة؟", {
      confirmLabel: "مسح",
      cancelLabel: "إلغاء",
    }).then((confirmed) => {
      if (!confirmed) return;
      clearChat();
      trackEvent("ai_chat_cleared");
      toast.success("تم مسح سجل المحادثة");
    });
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
      toast.error("فشل في إنشاء ملخص", {
        description: "تأكد من تحميل بيانات المحادثة أولاً.",
      });
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
    // If logged in, only use Supabase drafts.
    // If guest, use localStorage.
    if (!loading) {
      if (user) {
        loadSupabaseDrafts();
      } else {
        const arr = readLocalQuizzes();
        setLocalGeneratedQuizzes(arr);
        setGeneratedQuiz((prev) => prev || arr[0] || null);
      }
    }
  }, [loadSupabaseDrafts, readLocalQuizzes, user, loading]);

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
      toast.error("بيانات ناقصة", {
        description: "من فضلك اختر الصف/المستوى والقسم والمادة قبل الإرسال.",
      });
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
          title: generatedQuiz.data.title,
          content: JSON.stringify(generatedQuiz.data.questions),
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
      toast.error("فشل إرسال الامتحان للمراجعة", {
        description: "حاول مرة أخرى.",
      });
    } finally {
      setIsSubmittingQuiz(false);
    }
  }, [
    generatedQuiz,
    isSubmittingQuiz,
    setMessages,
    trackEvent,
    user,
    submitAcademicLevel,
    submitDepartment,
    submitSemester,
    submitSubject,
  ]);

  // Generate quiz from user input
  const handleGenerateQuiz = async () => {
    if (isGeneratingQuiz || !quizTextInput.trim() || loading) return;

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
          toast.error("خطأ في صيغة JSON", {
            description: "تأكد من صحة البيانات.",
          });
          setIsGeneratingQuiz(false);
          return;
        }
      } else {
        // Generate quiz from text using AI
        const response = await aiAssistant.generateQuiz(quizTextInput);
        quizData = response as QuizDataInput;
      }

      const questions = quizData.questions || [];
      const clientGeneratedId = crypto.randomUUID();

      const localQuiz: LocalGeneratedQuiz = {
        localId: clientGeneratedId,
        createdAt: new Date().toISOString(),
        data: {
          title: quizData.title,
          description: quizData.description,
          questions,
        },
      };

      if (user) {
        // Save directly to Supabase with client-side UUID
        await quizService.saveAiGeneratedDraft(user.id, {
          id: clientGeneratedId,
          title: localQuiz.data.title,
          description: localQuiz.data.description,
          questions: localQuiz.data.questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          })),
        });
        await loadSupabaseDrafts();
      } else {
        // Guest: Only use localStorage
        setGeneratedQuiz(localQuiz);
        persistLocalQuiz(localQuiz);
      }

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
      toast.error("فشل إنشاء الاختبار", {
        description: "يرجى المحاولة مرة أخرى.",
      });
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
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl p-4 sm:p-5 mb-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {mode === "group_rag"
                ? t("assistantGroupChat")
                : mode === "student_agent"
                  ? t("assistantStudent")
                  : t("smartAssistant")}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {mode === "group_rag"
                  ? t("assistantGroupChat")
                  : mode === "student_agent"
                    ? t("responseFromPlatform")
                    : t("generalCsAssistant")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={toggleMode}
            className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 hover:shadow-sm"
            title={
              mode === "group_rag"
                ? t("switchCsAssistant")
                : mode === "cs_assistant"
                  ? t("switchStudentAssistant")
                  : t("switchGroupChat")
            }
          >
            <span className="sm:hidden flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </span>
            <span className="hidden sm:inline">
              {t("switchLabel")}
              {mode === "group_rag"
                ? t("assistantProgramming")
                : mode === "cs_assistant"
                  ? t("assistantStudent")
                  : t("assistantGroupChat")}
            </span>
          </button>

          {mode === "student_agent" && (
            <div className="flex items-center gap-2 px-2">
              <select
                value={studentSelectedSubject}
                onChange={(e) => setStudentSelectedSubject(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value="">{t("selectSubject")}</option>
                {studentSubjects?.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={studentSelectedQuizId}
                onChange={(e) => setStudentSelectedQuizId(e.target.value)}
                disabled={
                  !studentSelectedSubject ||
                  studentQuizzesLoading ||
                  studentQuizzes.length === 0
                }
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60"
              >
                <option value="">
                  {studentQuizzesLoading
                    ? t("loadingExams")
                    : studentQuizzes.length === 0
                      ? t("noExams")
                      : t("selectExam")}
                </option>
                {studentQuizzes.map((qz) => (
                  <option key={qz.id} value={qz.id}>
                    {qz.title}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (studentSelectedQuizId)
                    setActiveQuizId(studentSelectedQuizId);
                }}
                disabled={!studentSelectedQuizId}
                className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                title={t("startExam")}
              >
                {t("start")}
              </button>
            </div>
          )}

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
          {/* تم إخفاء زر تسجيل Puter لأنه يتم التفعيل تلقائياً عند الحاجة */}
          {false && (
            <button
              onClick={() => setShowPuterModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${
                isPuterSignedIn
                  ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20 shadow-sm shadow-green-500/10"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500 hover:border-indigo-200"
              }`}
              title={
                isPuterSignedIn
                  ? "إعدادات المساعد (متصل)"
                  : "تحسين أداء المساعد"
              }
            >
              {isPuterSignedIn ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold hidden md:inline">
                    متصل
                  </span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span className="text-xs font-bold hidden md:inline">
                    تفعيل المساعد
                  </span>
                </>
              )}
            </button>
          )}
          <button
            onClick={handleSummarizeChat}
            disabled={isSummarizing || !hasChatData}
            className={`p-2 rounded-xl transition-all ${
              isSummarizing || !hasChatData
                ? "text-slate-300"
                : "text-slate-400 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-700"
            }`}
            title="تلخيص المحادثة (آخر 100 رسالة)"
          >
            {isSummarizing ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
          <button
            onClick={handleClearChat}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
            title="مسح المحادثة"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {generatedQuiz?.data && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
              <button
                onClick={() => setShowGeneratedQuizModal(true)}
                className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all text-sm font-bold"
                title={`آخر اختبار مولّد: ${generatedQuiz.data.title}`}
              >
                آخر اختبار
                {safeLocalGeneratedQuizzes.length > 1
                  ? ` (${safeLocalGeneratedQuizzes.length})`
                  : ""}
              </button>
            </>
          )}
        </div>
      </div>

      {showGeneratedQuizModal && generatedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl modern-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t("lastGeneratedExam")}
              </h3>
              <button
                onClick={() => setShowGeneratedQuizModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                aria-label={t("close")}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {generatedQuiz?.data && (
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {generatedQuiz.data.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {user ? t("userExamNotice") : t("guestExamNotice")}
                  </div>
                </div>
              )}

              {safeLocalGeneratedQuizzes.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    {t("selectExam")}
                  </div>
                  <select
                    value={generatedQuiz?.localId || ""}
                    onChange={(e) => {
                      const next = safeLocalGeneratedQuizzes.find(
                        (q) => q.localId === e.target.value,
                      );
                      if (!next) return;
                      setGeneratedQuiz(next);
                      resetLocalQuizPlayer();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
                  >
                    {safeLocalGeneratedQuizzes.map((q) => (
                      <option key={q.localId} value={q.localId}>
                        {q.data?.title || t("noTitle")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <button
                  onClick={() => {
                    setShowGeneratedQuizModal(false);
                    handleOpenLocalQuiz();
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm font-semibold"
                >
                  فتح الاختبار
                </button>
                {user && (
                  <button
                    onClick={() => {
                      setShowGeneratedQuizModal(false);
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
                    title="سيتم إرسال الامتحان للمراجعة. سيتم ربطه بهويتك (created_by)"
                  >
                    {isSubmittingQuiz
                      ? "جاري الإرسال..."
                      : "إرسال للمراجعة والنشر"}
                  </button>
                )}
              </div>
            </div>
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
                  disabled={optionsLoading}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm disabled:opacity-50"
                >
                  <option value="" disabled>
                    {optionsLoading ? "جاري التحميل..." : "اختر المستوى..."}
                  </option>
                  {!optionsLoading &&
                    levels.map((lvl) => (
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
                    optionsLoading ||
                    !submitAcademicLevel ||
                    availableSubmitDepartments.length === 0
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm disabled:opacity-50"
                >
                  <option value="" disabled>
                    {optionsLoading ? "جاري التحميل..." : "اختر القسم..."}
                  </option>
                  {!optionsLoading &&
                    availableSubmitDepartments.map((dep) => (
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
                  {submitSubjects &&
                    submitSubjects.map((s) => (
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

      {/* Chat Messages */}
      <div className="flex-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-3xl mb-4 overflow-hidden flex flex-col shadow-sm">
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar scroll-smooth"
        >
          {!isReady ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                  جاري استعادة المحادثة...
                </p>
              </div>
            </div>
          ) : safeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500 shrink-0">
                <Bot className="w-12 h-12 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
                {t("welcomeTitle")}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed text-[15px]">
                {t("welcomeDescription")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 w-full max-w-lg">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:border-indigo-300/50 dark:hover:border-indigo-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all text-right"
                    style={{ animationDelay: `${i * 100}ms` }}
                    dir="auto"
                  >
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            safeMessages.map((msg) => (
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
        <div className="relative p-3 sm:p-5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 shrink-0">
          {mode === "student_agent" && (
            <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={studentSelectedSubject}
                onChange={(e) => setStudentSelectedSubject(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                <option value="">اختر المادة</option>
                {studentSubjects?.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={studentSelectedQuizId}
                onChange={(e) => setStudentSelectedQuizId(e.target.value)}
                disabled={
                  !studentSelectedSubject ||
                  studentQuizzesLoading ||
                  studentQuizzes.length === 0
                }
                className="w-full sm:w-auto px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-bold disabled:opacity-60"
              >
                <option value="">
                  {studentQuizzesLoading
                    ? "جاري تحميل الامتحانات..."
                    : studentQuizzes.length === 0
                      ? "لا يوجد امتحانات"
                      : "اختر الامتحان"}
                </option>
                {studentQuizzes.map((qz) => (
                  <option key={qz.id} value={qz.id}>
                    {qz.title}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (studentSelectedQuizId)
                    setActiveQuizId(studentSelectedQuizId);
                }}
                disabled={!studentSelectedQuizId}
                className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-extrabold disabled:opacity-50"
              >
                ابدأ الامتحان
              </button>
            </div>
          )}
          <div className="flex gap-2 sm:gap-3 items-end bg-slate-50/80 dark:bg-slate-900/80 p-2 sm:p-2.5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400/50 transition-all z-20 relative">
            <button
              onClick={handleOpenQuizModal}
              className="h-[46px] w-[46px] shrink-0 rounded-[18px] flex items-center justify-center transition-all bg-white dark:bg-slate-800 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-sm"
              title="إنشاء اختبار من نص"
            >
              <Brain className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 flex items-center">
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
                placeholder={t("inputPlaceholder")}
                rows={1}
                className="w-full bg-transparent px-3 py-3 focus:outline-none resize-none text-[15px] text-slate-900 dark:text-white custom-scrollbar disabled:opacity-50 min-h-[46px] max-h-[150px] leading-relaxed block placeholder:text-slate-400 dark:placeholder:text-slate-500"
                dir="auto"
                style={{ height: "46px" }}
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className={`h-[46px] w-[46px] shrink-0 flex items-center justify-center transition-all ${"rounded-[18px]"} ${
                !inputMessage.trim() || isLoading
                  ? "bg-slate-200/80 dark:bg-slate-800/80 text-slate-400"
                  : "bg-slate-950 text-cyan-200 border border-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_18px_rgba(34,211,238,0.25)] hover:shadow-[0_0_0_2px_rgba(34,211,238,0.35),0_0_26px_rgba(34,211,238,0.35)] hover:text-cyan-100 hover:border-cyan-200/80 active:scale-[0.98]"
              }`}
            >
              <Send className="w-5 h-5 -ml-1" />
            </button>
          </div>
          <p className="text-[11px] font-medium text-center text-slate-400/80 dark:text-slate-500 mt-2.5 hidden sm:block">
            {t("aiDisclaimer")}
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
              {!generatedQuiz?.data?.questions ||
              generatedQuiz.data.questions.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 p-8">
                  لا توجد أسئلة في هذا الاختبار.
                </div>
              ) : (
                (() => {
                  const questions = generatedQuiz.data.questions;
                  const q = questions[localQuizIndex];
                  if (!q) return null;
                  const correct = q.correctAnswer;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          سؤال {localQuizIndex + 1} من {questions.length}
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
                        {q.options?.map((opt, idx) => {
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
                              if (localQuizIndex >= questions.length - 1)
                                return;
                              setLocalQuizIndex((prev) =>
                                Math.min(questions.length - 1, prev + 1),
                              );
                              setLocalSelectedOption(null);
                              setLocalAnswered(false);
                            }}
                            disabled={localQuizIndex >= questions.length - 1}
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
                  {summaryResult?.important_messages &&
                    summaryResult.important_messages.map(
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
      {showPuterModal && (
        <PuterSettingsModal
          isOpen={showPuterModal}
          onClose={() => setShowPuterModal(false)}
        />
      )}
    </div>
  );
}

export default AiAssistantChatPage;
