import { useState, useEffect, useCallback } from 'react';
import { quizService } from '../lib/quiz';

interface Answer {
    question_id: string;
    selected_option: number;
    is_correct: boolean;
}

interface UseQuizAttemptProps {
    quizId: string;
    userId: string | undefined;
    totalQuestions: number;
    quizTitle?: string;
}

export function useQuizAttempt({ quizId, userId, totalQuestions, quizTitle }: UseQuizAttemptProps) {
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, Answer>>({}); // Map questionId -> Answer
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Initialize attempt
    useEffect(() => {
        if (!userId || !quizId) {
            setLoading(false);
            return;
        }

        const initAttempt = async () => {
            try {
                setLoading(true);
                const { attempt, answers: existingAnswers } = await quizService.startAttempt(quizId, userId);

                setAttemptId(attempt.id);
                setStartTime(new Date(attempt.started_at).getTime());

                // Hydrate answers
                const answersMap: Record<string, Answer> = {};
                existingAnswers.forEach((ans: any) => {
                    answersMap[ans.question_id] = {
                        question_id: ans.question_id,
                        selected_option: ans.selected_option,
                        is_correct: ans.is_correct
                    };
                });

                // Merge with localStorage if needed
                if (existingAnswers.length === 0) {
                    const localData = localStorage.getItem(`quiz_attempt_${quizId}_${userId}`);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            setAnswers(parsed);
                        } catch (e) {
                            console.error("Failed to parse local storage", e);
                        }
                    }
                } else {
                    setAnswers(answersMap);
                }

            } catch (err: any) {
                console.error("Failed to init attempt:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        initAttempt();
    }, [quizId, userId]);

    // Save answer
    const saveAnswer = useCallback(async (questionId: string, selectedOption: number, isCorrect: boolean) => {
        const newAnswer: Answer = { question_id: questionId, selected_option: selectedOption, is_correct: isCorrect };

        // Optimistic update - ALWAYS update local state first
        setAnswers(prev => {
            const next = { ...prev, [questionId]: newAnswer };
            // Save to local storage
            if (userId) {
                localStorage.setItem(`quiz_attempt_${quizId}_${userId}`, JSON.stringify(next));
            }
            return next;
        });

        if (!attemptId || !userId) {
            console.warn("No attemptId or userId, skipping DB save");
            return;
        }

        try {
            setSaving(true);
            await quizService.saveAnswer(attemptId, questionId, selectedOption, isCorrect);
        } catch (err) {
            console.error("Failed to save answer to DB:", err);
        } finally {
            setSaving(false);
        }
    }, [attemptId, userId, quizId]);

    // Finish attempt
    const finishAttempt = useCallback(async (score: number, timeTakenSeconds?: number) => {
        const finishedAt = new Date().toISOString();
        const answersArray = Object.values(answers);

        // Prepare local history entry
        const historyEntry = {
            id: attemptId || `local_${Date.now()}`,
            quiz_id: quizId,
            user_id: userId || 'guest',
            score,
            total_questions: totalQuestions,
            answers: answersArray,
            started_at: startTime ? new Date(startTime).toISOString() : finishedAt,
            finished_at: finishedAt,
            created_at: finishedAt,
            time_taken_seconds: timeTakenSeconds,
            status: 'completed',
            is_local: !attemptId,
            quizzes: { title: quizTitle || 'امتحان' } // Mock the relation for history page
        };

        // Always save to local history first
        try {
            const localHistory = JSON.parse(localStorage.getItem('quiz_history') || '[]');
            // Avoid duplicates if attemptId exists
            const filteredHistory = localHistory.filter((h: any) => h.id !== attemptId);
            localStorage.setItem('quiz_history', JSON.stringify([historyEntry, ...filteredHistory]));
        } catch (e) {
            console.error("Failed to save to local history", e);
        }

        // Clear current attempt progress
        if (userId) {
            localStorage.removeItem(`quiz_attempt_${quizId}_${userId}`);
        } else {
            localStorage.removeItem(`quiz_attempt_${quizId}_guest`);
        }

        // If logged in and have attemptId, sync to DB
        if (attemptId && userId) {
            try {
                setSaving(true);
                await quizService.finishAttempt(attemptId, score, totalQuestions, answersArray);
            } catch (err: any) {
                console.error("Failed to finish attempt in DB:", err);
                setError(err.message);
                throw err;
            } finally {
                setSaving(false);
            }
        }
    }, [attemptId, answers, totalQuestions, quizId, userId, startTime]);

    return {
        attemptId,
        answers,
        loading,
        saving,
        error,
        startTime,
        saveAnswer,
        finishAttempt,
        isGuest: !userId
    };
}
