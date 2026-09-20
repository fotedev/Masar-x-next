"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAiChat } from "@/hooks/useAiChat";
import { useSubjects } from "@/hooks/useSubjects";
import { useQuizzes } from "@/hooks/useQuizzes";
import { ChatHeader } from "@/components/ai/ChatHeader";
import { ChatContainer } from "@/components/ai/ChatContainer";
import { ChatInput } from "@/components/ai/ChatInput";
import { AIErrorBoundary } from "@/components/AIErrorBoundary";
import { useChatScroll } from "@/hooks/useChatScroll";
import { ArrowDown } from "lucide-react";
import { aiAssistant } from "@/lib/ai-assistant";
import { toast } from "sonner";
import { useRouter } from '@/navigation';
import { initPuterDiagnostics } from "@/lib/puter";

const PuterSettingsModal = dynamic(
  () => import("@/components/ai/PuterSettingsModal"),
  {
    ssr: false,
  },
);

const LocalQuizPreviewModal = dynamic(
  () =>
    import("@/components/ai/LocalQuizPreviewModal").then(
      (mod) => mod.LocalQuizPreviewModal,
    ),
  {
    ssr: false,
  },
);

type LocalGeneratedQuiz = {
  id?: string;
  localId?: string;
  data?: {
    title?: string;
  };
};

export default function AiAssistantPage() {
  const t = useTranslations("aiAssistant");
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const router = useRouter();

  const {
    messages,
    isLoading,
    isReady,
    sendMessage,
    clearChat,
    mode,
    setMode,
    studentSelectedSubject,
    setStudentSelectedSubject,
    loadOlder,
    hasMoreOlder,
    loadingOlder,
  } = useAiChat(user, trackEvent);

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("zane_ai_selected_model") || "claude-sonnet-4-6"
      );
    }
    return "claude-sonnet-4-6";
  });

  // Spec 012: every callback below is useCallback-stable so that typing (the
  // only state that changes per keystroke) re-renders just ChatInput — the
  // memoized ChatContainer and every ChatMessageItem keep their identities.
  const handleModelChange = useCallback((model: string) => {
    const isPuterBackedModel = model.startsWith("claude");
    if (isPuterBackedModel && typeof window !== "undefined") {
      const key = "puter_diagnostics_initialized";
      if (sessionStorage.getItem(key) !== "1") {
        initPuterDiagnostics();
        sessionStorage.setItem(key, "1");
      }
    }
    setSelectedModel(model);
    localStorage.setItem("zane_ai_selected_model", model);
  }, []);

  const isInitialState = messages.length === 0;

  const handleSuggestionClick = useCallback(
    async (suggestion: string) => {
      await sendMessage(suggestion, selectedModel);
    },
    [sendMessage, selectedModel],
  );

  const handleUiMessage = useCallback(
    async (content: string) => {
      await sendMessage(content, selectedModel);
    },
    [sendMessage, selectedModel],
  );

  const { subjects: studentSubjects } = useSubjects();
  const [studentSelectedQuizId, setStudentSelectedQuizId] = useState("");
  const { quizzes: studentQuizzes, loading: studentQuizzesLoading } =
    useQuizzes();

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showPuterSettings, setShowPuterSettings] = useState(false);
  const [showGeneratedQuizModal, setShowGeneratedQuizModal] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<LocalGeneratedQuiz | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null!);

  // Spec 011: stick-when-near-bottom scrolling (streaming + new messages),
  // instant jump to the newest message after a history sync, and the
  // isNearBottom flag that drives the scroll-to-end pill.
  const {
    containerRef: messagesContainerRef,
    isNearBottom,
    stickToBottom,
  } = useChatScroll(messages);

  const [inputMessage, setInputMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null!);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return;
    const content = inputMessage;
    setInputMessage("");
    await sendMessage(content, selectedModel);
  }, [inputMessage, sendMessage, selectedModel]);

  const handleSummarizeChat = useCallback(async () => {
    try {
      setIsSummarizing(true);

      let analysis;
      if (mode === "student_agent") {
        if (!studentSelectedSubject) {
          toast.error("يرجى اختيار مادة أولاً لتلخيص محتواها الأكاديمي.");
          return;
        }
        // Use the messages as context for student agent too if relevant,
        // but the method expects subject + context.
        // For now, let's use the current chat as context for the academic summary.
        const context = messages.map((m) => m.content).join("\n");
        analysis = await aiAssistant.summarizeAcademicContext(
          studentSelectedSubject,
          context,
        );
      } else if (mode === "cs_assistant") {
        const formattedMessages = messages.map((m) => ({
          role:
            m.type === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));
        analysis = await aiAssistant.summarizeCurrentChat(formattedMessages);
      } else {
        // group_rag
        analysis = await aiAssistant.summarizeLoadedData();
      }

      if (analysis?.summary) {
        toast.success(t("chatSummarized"));
        // Optional: show the summary in a toast or special message
        // For now, just a success toast as per existing logic
      }
    } catch (error) {
      void error;
      toast.error(t("summarizeError"));
    } finally {
      setIsSummarizing(false);
    }
  }, [mode, messages, studentSelectedSubject, t]);

  const handleStartQuiz = useCallback(() => {
    if (studentSelectedQuizId) {
      router.push(`/quiz-play/${studentSelectedQuizId}`);
    }
  }, [router, studentSelectedQuizId]);

  const handleShowGeneratedQuizModal = useCallback(() => {
    setShowGeneratedQuizModal(true);
  }, []);

  const handleOpenPuterSettings = useCallback(() => {
    initPuterDiagnostics();
    setShowPuterSettings(true);
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-dvh-safe">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AIErrorBoundary>
      <div
        className="flex h-full min-h-0 w-full flex-col"
      >
        {!isInitialState && (
          <ChatHeader
            mode={mode}
            studentSelectedSubject={studentSelectedSubject}
            setStudentSelectedSubject={setStudentSelectedSubject}
            studentSubjects={studentSubjects}
            studentSelectedQuizId={studentSelectedQuizId}
            setStudentSelectedQuizId={setStudentSelectedQuizId}
            studentQuizzes={studentQuizzes}
            studentQuizzesLoading={studentQuizzesLoading}
            onStartQuiz={handleStartQuiz}
            generatedQuiz={generatedQuiz}
            onShowGeneratedQuizModal={handleShowGeneratedQuizModal}
            safeLocalGeneratedQuizzesCount={0}
            t={t}
          />
        )}

        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            t={t}
            isInitialState={isInitialState}
            mode={mode}
            onSuggestionClick={handleSuggestionClick}
            onUiMessage={handleUiMessage}
            hasUserInput={inputMessage.trim().length > 0}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlder}
          />

          {/* Spec 011: floating jump-to-latest pill while scrolled away from
              the bottom. Hidden while detached during the hero state. */}
          {!isInitialState && !isNearBottom && (
            <button
              type="button"
              onClick={() => stickToBottom("smooth")}
              className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-600 shadow-lg backdrop-blur-md transition-colors hover:border-cyan-500/40 hover:text-cyan-600 dark:border-slate-700/80 dark:bg-slate-900/85 dark:text-slate-300 dark:hover:text-cyan-400"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {t("scrollToEnd")}
            </button>
          )}
        </div>

        <ChatInput
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          inputRef={inputRef}
          t={t}
          isInitialState={isInitialState}
          user={user}
          mode={mode}
          setMode={setMode}
          selectedModel={selectedModel}
          setSelectedModel={handleModelChange}
          onSummarizeChat={handleSummarizeChat}
          onClearChat={clearChat}
          isSummarizing={isSummarizing}
          hasChatData={messages.length > 0}
          onOpenPuterSettings={handleOpenPuterSettings}
        />

        {showPuterSettings && (
          <PuterSettingsModal
            isOpen={showPuterSettings}
            onClose={() => setShowPuterSettings(false)}
          />
        )}

        {showGeneratedQuizModal && generatedQuiz && (
          <LocalQuizPreviewModal
            generatedQuiz={generatedQuiz}
            safeLocalGeneratedQuizzes={[]}
            setGeneratedQuiz={setGeneratedQuiz}
            resetLocalQuizPlayer={() => {}}
            onOpenLocalQuiz={() => {
              if (generatedQuiz?.id) {
                router.push(`/quiz-play/${generatedQuiz.id}`);
              }
            }}
            onClose={() => setShowGeneratedQuizModal(false)}
            user={user}
            t={t}
          />
        )}
      </div>
    </AIErrorBoundary>
  );
}
