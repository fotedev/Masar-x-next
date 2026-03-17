import { useCallback, useEffect, useState } from "react";
import { quizService } from "../lib/quiz";

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
  quizData?: LocalQuizData;
  trackEvent: (event: string, payload?: Record<string, unknown>) => void;
}) {
  const { quizId, quizData, trackEvent } = props;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const loadQuiz = useCallback(async () => {
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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [quizData, quizId, trackEvent]);

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
