"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
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
import { aiAssistant } from "@/lib/ai-assistant";
import { toast } from "react-hot-toast";
import { useRouter } from "@/i18n/routing";
import { initPuterDiagnostics } from "@/lib/puter";

const PuterSettingsModal = dynamic(() => import("@/components/ai/PuterSettingsModal"), {
  ssr: false,
});

const LocalQuizPreviewModal = dynamic(() => import("@/components/ai/LocalQuizPreviewModal").then(mod => mod.LocalQuizPreviewModal), {
  ssr: false,
});

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
    isPuterSignedIn,
    mode,
    setMode,
    studentSelectedSubject,
    setStudentSelectedSubject,
  } = useAiChat(user, trackEvent);

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("zane_ai_selected_model") || "claude-sonnet-4-6";
    }
    return "claude-sonnet-4-6";
  });

  const handleModelChange = (model: string) => {
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
  };

  const isInitialState = messages.length === 0;

  const handleSuggestionClick = async (suggestion: string) => {
    await sendMessage(suggestion, selectedModel);
  };

  const handleUiMessage = async (content: string) => {
    await sendMessage(content, selectedModel);
  };

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

  const messagesContainerRef = useRef<HTMLDivElement>(null!);
  const messagesEndRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if the user is already at the bottom of the internal container
    const isAtBottom = 
      container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

    if (isAtBottom || isLoading) {
      // Direct scroll on the container element itself to avoid page-level jumping
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isLoading]);

  const [inputMessage, setInputMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null!);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const content = inputMessage;
    setInputMessage("");
    await sendMessage(content, selectedModel);
  };

  const handleSummarizeChat = async () => {
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
        const context = messages.map(m => m.content).join('\n');
        analysis = await aiAssistant.summarizeAcademicContext(studentSelectedSubject, context);
      } else if (mode === "cs_assistant") {
        const formattedMessages = messages.map(m => ({
          role: m.type === "assistant" ? "assistant" as const : "user" as const,
          content: m.content
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
  };

  const handleStartQuiz = () => {
    if (studentSelectedQuizId) {
      router.push(`/quiz-play/${studentSelectedQuizId}`);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AIErrorBoundary>
      <div className={`flex flex-col max-w-5xl mx-auto transition-all duration-500 ${
        isInitialState 
          ? "h-screen justify-center items-center px-4 py-4" 
          : "h-[100dvh] pt-0 pb-2 px-0 sm:px-4"
      }`}>
        {!isInitialState && (
          <ChatHeader
            mode={mode}
            setMode={setMode}
            selectedModel={selectedModel}
            setSelectedModel={handleModelChange}
            onOpenPuterSettings={() => {
              initPuterDiagnostics();
              setShowPuterSettings(true);
            }}
            studentSelectedSubject={studentSelectedSubject}
            setStudentSelectedSubject={setStudentSelectedSubject}
            studentSubjects={studentSubjects}
            studentSelectedQuizId={studentSelectedQuizId}
            setStudentSelectedQuizId={setStudentSelectedQuizId}
            studentQuizzes={studentQuizzes}
            studentQuizzesLoading={studentQuizzesLoading}
            onStartQuiz={handleStartQuiz}
            onSummarizeChat={handleSummarizeChat}
            onClearChat={clearChat}
            isSummarizing={isSummarizing}
            hasChatData={messages.length > 0}
            generatedQuiz={generatedQuiz}
            onShowGeneratedQuizModal={() => setShowGeneratedQuizModal(true)}
            safeLocalGeneratedQuizzesCount={0}
            t={t}
          />
        )}

        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          t={t}
          isInitialState={isInitialState}
          mode={mode}
          setMode={setMode}
          onSuggestionClick={handleSuggestionClick}
          onOpenPuterSettings={() => {
            initPuterDiagnostics();
            setShowPuterSettings(true);
          }}
          isPuterSignedIn={isPuterSignedIn}
          onUiMessage={handleUiMessage}
        />

        <ChatInput
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          inputRef={inputRef}
          t={t}
          isInitialState={isInitialState}
          user={user}
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
