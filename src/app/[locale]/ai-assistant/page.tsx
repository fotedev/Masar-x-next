"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAiChat } from "@/hooks/useAiChat";
import { useSubjects } from "@/hooks/useSubjects";
import { useQuizzes } from "@/hooks/useQuizzes";
import { ChatHeader } from "@/components/ai/ChatHeader";
import { ChatContainer } from "@/components/ai/ChatContainer";
import { ChatInput } from "@/components/ai/ChatInput";
import PuterSettingsModal from "@/components/ai/PuterSettingsModal";
import { LocalQuizPreviewModal } from "@/components/ai/LocalQuizPreviewModal";
import { aiAssistant } from "@/lib/ai-assistant";
import { toast } from "react-hot-toast";
import { useRouter } from "@/i18n/routing";

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
  } = useAiChat(user, trackEvent);

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

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const [inputMessage, setInputMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const content = inputMessage;
    setInputMessage("");
    await sendMessage(content);
  };

  const handleSummarizeChat = async () => {
    try {
      setIsSummarizing(true);
      await aiAssistant.summarizeLoadedData();
      toast.success(t("chatSummarized"));
    } catch {
      toast.error(t("summarizeError"));
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleStartQuiz = () => {
    if (studentSelectedQuizId) {
      router.push(`/quiz-play?quizId=${studentSelectedQuizId}`);
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
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] max-w-5xl mx-auto px-4 py-4">
      <ChatHeader
        mode={mode}
        toggleMode={() =>
          setMode((prev) =>
            prev === "cs_assistant"
              ? "student_agent"
              : prev === "student_agent"
                ? "group_rag"
                : "cs_assistant",
          )
        }
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

      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        t={t}
      />

      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        suggestions={[]}
        onSuggestionClick={(s: string) => {
          setInputMessage(s);
          inputRef.current?.focus();
        }}
        inputRef={inputRef}
        t={t}
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
              router.push(`/quiz-play?quizId=${generatedQuiz.id}`);
            }
          }}
          onClose={() => setShowGeneratedQuizModal(false)}
          user={user}
          t={t}
        />
      )}
    </div>
  );
}
