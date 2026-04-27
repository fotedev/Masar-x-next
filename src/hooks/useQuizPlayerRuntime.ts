import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type SavedAnswer = {
  selected_option: number;
  is_correct: boolean;
};

export function useQuizPlayerRuntime(props: {
  quizId?: string;
  quiz: Quiz | null;
  questions: Question[];
  savedAnswers: Record<string, SavedAnswer>;
  attemptStartTime: number | null;
  score: number;
  saveAnswer: (questionId: string, selectedOption: number, isCorrect: boolean) => void;
  saveFinishAttempt: (score: number, timeTakenSeconds?: number) => Promise<void>;
  trackEvent: (event: string, payload?: Record<string, unknown>) => void;
  onComplete?: (score: number) => void;
}) {
  const {
    quizId,
    quiz,
    questions,
    savedAnswers,
    attemptStartTime,
    score,
    saveAnswer,
    saveFinishAttempt,
    trackEvent,
    onComplete,
  } = props;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState<number | null>(null);
  const [endedByTimeout, setEndedByTimeout] = useState(false);

  const endTimeMsRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  // T038: Use ref for score to avoid recreating finishQuiz callback on every score change
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const currentQuestion = useMemo(
    () => questions[currentQuestionIndex] ?? null,
    [questions, currentQuestionIndex],
  );

  const finishQuiz = useCallback(
    async (timeout = false) => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      if (timeout) setEndedByTimeout(true);

      const finishedAtMs = Date.now();
      const startedAtMs = attemptStartTime || finishedAtMs;
      const takenSeconds = Math.max(
        0,
        Math.round((finishedAtMs - startedAtMs) / 1000),
      );

      setTimeTakenSeconds(takenSeconds);
      setShowResults(true);

      // T038: Use current score from ref to avoid dependency issues
      const currentScore = scoreRef.current;

      try {
        await saveFinishAttempt(currentScore, takenSeconds);
      } catch {
        // ignore
      }

      trackEvent("quiz_completed", {
        quiz_id: quizId,
        score: currentScore,
        total: questions.length,
        ended_by_timeout: timeout,
      });

      if (onComplete) onComplete(currentScore);
    },
    [
      attemptStartTime,
      onComplete,
      questions.length,
      quizId,
      saveFinishAttempt,
      // T038: Removed score from dependencies to prevent timer reset bug
      trackEvent,
    ],
  );

  const formatTime = useCallback((totalSeconds: number) => {
    const s = Math.max(0, totalSeconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }, []);

  const startQuiz = useCallback(() => {
    const now = Date.now();
    const durationSeconds =
      typeof quiz?.duration_seconds === "number" ? quiz.duration_seconds : null;

    if (durationSeconds && durationSeconds > 0) {
      endTimeMsRef.current = now + durationSeconds * 1000;
      setTimeLeftSeconds(durationSeconds);
    } else {
      endTimeMsRef.current = null;
      setTimeLeftSeconds(null);
    }

    setHasStarted(true);
    trackEvent("quiz_started", { quiz_id: quizId, title: quiz?.title });
  }, [quiz?.duration_seconds, quiz?.title, quizId, trackEvent]);

  useEffect(() => {
    if (!hasStarted || showResults) return;
    if (!endTimeMsRef.current) return;

    const interval = window.setInterval(() => {
      if (!endTimeMsRef.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((endTimeMsRef.current - Date.now()) / 1000),
      );
      setTimeLeftSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        finishQuiz(true);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasStarted, showResults, finishQuiz]);

  useEffect(() => {
    if (questions.length > 0) {
      const currentQ = questions[currentQuestionIndex];
      const savedAnswer = savedAnswers[currentQ.id];

      if (savedAnswer) {
        setSelectedOption(savedAnswer.selected_option);
        setIsAnswered(true);
      } else {
        setSelectedOption(null);
        setIsAnswered(false);
      }
    }
  }, [currentQuestionIndex, questions, savedAnswers]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && !showResults && questions.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [showResults, questions.length, hasStarted]);

  const handleOptionSelect = useCallback(
    (index: number) => {
      if (isAnswered) return;
      setSelectedOption(index);
    },
    [isAnswered],
  );

  const handleSubmitAnswer = useCallback(() => {
    if (selectedOption === null) return;
    const q = questions[currentQuestionIndex];

    const isCorrect = Number(selectedOption) === Number(q.correct_answer);

    setIsAnswered(true);
    saveAnswer(q.id, selectedOption, isCorrect);

    trackEvent("question_answered", {
      quiz_id: quizId,
      question_index: currentQuestionIndex,
      is_correct: isCorrect,
    });
  }, [
    currentQuestionIndex,
    questions,
    quizId,
    saveAnswer,
    selectedOption,
    trackEvent,
  ]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  }, [currentQuestionIndex, finishQuiz, questions.length]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  const resetRuntime = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setShowResults(false);
    setHasStarted(false);
    setTimeLeftSeconds(null);
    setTimeTakenSeconds(null);
    setEndedByTimeout(false);
    endTimeMsRef.current = null;
    finishingRef.current = false;
  }, []);

  const durationMinutes = useMemo(() => {
    return quiz?.duration_seconds ? Math.round(quiz.duration_seconds / 60) : null;
  }, [quiz?.duration_seconds]);

  return {
    currentQuestion,
    currentQuestionIndex,
    selectedOption,
    isAnswered,
    showResults,
    hasStarted,
    timeLeftSeconds,
    timeTakenSeconds,
    endedByTimeout,
    durationMinutes,
    formatTime,
    startQuiz,
    finishQuiz,
    handleOptionSelect,
    handleSubmitAnswer,
    handleNextQuestion,
    handlePreviousQuestion,
    resetRuntime,
  };
}
