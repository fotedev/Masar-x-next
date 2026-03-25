import { useState, useEffect, useCallback } from 'react';
import { quizService } from '../lib/quiz';
import type { Json } from '@/types/database';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

interface Answer {
    question_id: string;
    selected_option: number;
    is_correct: boolean;
    updated_at?: string;
}

interface UseQuizAttemptProps {
    quizId: string;
    userId: string | undefined;
    totalQuestions: number;
    quizTitle?: string;
    localOnly?: boolean;
}

interface DatabaseAnswer {
    question_id: string;
    selected_option: number;
    is_correct: boolean;
    created_at: string;
}

interface QuizHistoryEntry {
    id: string;
    quiz_id: string;
    user_id: string;
    score: number;
    total_questions: number;
    answers: Answer[];
    started_at: string;
    finished_at: string;
    created_at: string;
    time_taken_seconds?: number;
    status: string;
    is_local: boolean;
    quizzes: { title: string };
}

export function useQuizAttempt({ quizId, userId, totalQuestions, quizTitle, localOnly = false }: UseQuizAttemptProps) {
    const { loading: authLoading } = useAuth();
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, Answer>>({}); // Map questionId -> Answer
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Initialize attempt
    useEffect(() => {
        if (localOnly) {
            setLoading(false);
            return;
        }

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
                existingAnswers.forEach((ans: DatabaseAnswer) => {
                    answersMap[ans.question_id] = {
                        question_id: ans.question_id,
                        selected_option: ans.selected_option,
                        is_correct: ans.is_correct,
                        updated_at: ans.created_at
                    };
                });

                // Merge with localStorage intelligently
                const localKey = `quiz_attempt_${quizId}_${userId}`;
                const localData = localStorage.getItem(localKey);
                if (localData) {
                    try {
                        const parsed: Record<string, Answer> = JSON.parse(localData);
                        Object.entries(parsed).forEach(([qId, localAns]) => {
                            const dbAns = answersMap[qId];
                            // Only use local answer if DB answer doesn't exist or local is newer
                            if (!dbAns || (localAns.updated_at && new Date(localAns.updated_at) > new Date(dbAns.updated_at || 0))) {
                                answersMap[qId] = localAns;
                            }
                        });
                        // Sync back merged state to localStorage
                        localStorage.setItem(localKey, JSON.stringify(answersMap));
                    } catch (e) {
                        logger.error('Error parsing local quiz data:', e);
                    }
                }
                
                setAnswers(answersMap);

            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        };

        initAttempt();
    }, [quizId, userId, localOnly]);

    // Save answer
    const saveAnswer = useCallback(async (questionId: string, selectedOption: number, isCorrect: boolean) => {
        const timestamp = new Date().toISOString();
        const newAnswer: Answer = { 
            question_id: questionId, 
            selected_option: selectedOption, 
            is_correct: isCorrect,
            updated_at: timestamp
        };

        // Optimistic update - ALWAYS update local state first
        setAnswers(prev => {
            const next = { ...prev, [questionId]: newAnswer };
            // Save to local storage
            if (userId) {
                localStorage.setItem(`quiz_attempt_${quizId}_${userId}`, JSON.stringify(next));
            }
            return next;
        });

        if (localOnly || !attemptId || !userId) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            await quizService.saveAnswer(attemptId, questionId, selectedOption, isCorrect);
        } catch (err) {
            logger.error('Failed to save answer to DB:', err);
            setError(err instanceof Error ? err.message : 'فشل حفظ الإجابة في السحابة. سيتم الاحتفاظ بها محلياً.');
            throw err;
        } finally {
            setSaving(false);
        }
    }, [attemptId, userId, quizId, localOnly]);

    // Finish attempt
    const finishAttempt = useCallback(async (score: number, timeTakenSeconds?: number) => {
        const finishedAt = new Date().toISOString();
        const answersArray = Object.values(answers);

        // Prepare local history entry
        const historyEntry: QuizHistoryEntry = {
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
            const localHistoryStr = localStorage.getItem('quiz_history');
            const localHistory: QuizHistoryEntry[] = localHistoryStr ? JSON.parse(localHistoryStr) : [];
            // Avoid duplicates if attemptId exists
            const filteredHistory = localHistory.filter((h: QuizHistoryEntry) => h.id !== attemptId);
            localStorage.setItem('quiz_history', JSON.stringify([historyEntry, ...filteredHistory]));
        } catch {
            // ignore
        }

        // Clear current attempt progress
        if (userId) {
            localStorage.removeItem(`quiz_attempt_${quizId}_${userId}`);
        } else {
            localStorage.removeItem(`quiz_attempt_${quizId}_guest`);
        }

        // If logged in and have attemptId, sync to DB
        if (!localOnly && attemptId && userId) {
            try {
                setSaving(true);
                const answersJson: Json[] = answersArray.map((a) => ({
                    question_id: a.question_id,
                    selected_option: a.selected_option,
                    is_correct: a.is_correct,
                }));
                await quizService.finishAttempt(attemptId, score, totalQuestions, answersJson);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("An unknown error occurred");
                }
                throw err;
            } finally {
                setSaving(false);
            }
        }
    }, [attemptId, answers, totalQuestions, quizId, userId, startTime, quizTitle, localOnly]);

    return {
        attemptId,
        answers,
        loading,
        saving,
        error,
        startTime,
        saveAnswer,
        finishAttempt,
        isGuest: !authLoading && !userId
    };
}
