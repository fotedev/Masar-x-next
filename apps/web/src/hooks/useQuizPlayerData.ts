import { useCallback, useEffect, useState } from "react";
import { quizService } from "../lib/quiz";
import { logger } from "../lib/logger";

type Quiz = {
  id: string;
  title: string;
  description?: string;
  duration_seconds?: number;
};

type Question = {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
  image_url?: string;
};

type LocalQuizData = {
  title: string;
  description?: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
};

export function useQuizPlayerData(props: {
  quizId?: string;
  /**
   * Spec 033 Track A: server-fetched payload (quiz-play RSC page). Seeded
   * directly into state so `loading` is false at first render and the
   * client fetch is skipped. Null means "server had nothing" — fall
   * through to the client fetch (its retry can still succeed).
   */
  initialQuiz?: {
    quiz: Record<string, unknown>;
    questions: Array<Record<string, unknown>>;
  } | null;
  quizData?: LocalQuizData;
  trackEvent: (event: string, payload?: Record<string, unknown>) => void;
}) {
  const { quizId, initialQuiz, quizData, trackEvent } = props;

  const [loading, setLoading] = useState(!initialQuiz);
  const [quiz, setQuiz] = useState<Quiz | null>(
    (initialQuiz?.quiz as Quiz | undefined) ?? null,
  );
  const [questions, setQuestions] = useState<Question[]>(
    (initialQuiz?.questions as Question[] | undefined) ?? [],
  );

  const loadQuiz = useCallback(async () => {
    if (initialQuiz) {
      // Already seeded server-side (spec 033) — nothing to fetch.
      return;
    }

    if (quizData) {
      setQuiz({
        id: "local",
        title: quizData.title,
        description: quizData.description,
      });
      setQuestions(
        quizData.questions.map((q, i) => ({
          id: `local-${i}`,
          question: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
        })),
      );
      setLoading(false);
      return;
    }

    if (!quizId) return;

    try {
      setLoading(true);
      const { quiz, questions } = await quizService.getQuiz(quizId);
      setQuiz(quiz);
      setQuestions(questions);
      trackEvent("quiz_loaded", { quiz_id: quizId, title: quiz.title });
    } catch (err) {
      // surfaced via logger until an i18n key exists
      logger.error("Failed to load quiz:", err);
    } finally {
      setLoading(false);
    }
  }, [initialQuiz, quizData, quizId, trackEvent]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  return {
    loading,
    quiz,
    questions,
    loadQuiz,
  };
}
