import { supabase } from './supabase';
import type { Json } from '@/types/database';


export interface QuizData {
    id?: string;
    title: string;
    description?: string;
    summary_id?: string | null;
    questions: {
        id?: string;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
        imageUrl?: string;
    }[];
}

export class QuizService {
    async saveAiGeneratedDraft(userId: string, quizData: QuizData) {
        try {
            const quizId = quizData.id || crypto.randomUUID();
            const draftPayload = {
                is_draft: true,
                draft_type: 'ai_generated',
                data: quizData,
            };

            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .upsert({
                    id: quizId,
                    title: quizData.title,
                    description: JSON.stringify(draftPayload),
                    content: JSON.stringify(quizData.questions),
                    summary_id: quizData.summary_id ?? null,
                    user_id: userId,
                    subject: 'AI Assistant',
                    level: 0,
                    semester: 1,
                    status: 'draft',
                    source_type: 'ai_generated_draft',
                    updated_at: new Date().toISOString(),
                } as any)
                .select('id')
                .single();

            if (quizError) throw quizError;
            return quiz.id as string;
        } catch (error) {
            throw error;
        }
    }

    async syncLocalQuizzes(userId: string, localQuizzes: any[]) {
        if (!userId || !localQuizzes.length) return { success: true, count: 0 };

        try {
            const results = await Promise.all(
                localQuizzes.map(async (local) => {
                    try {
                        // Ensure each local quiz has a UUID if it doesn't already
                        const quizData = {
                            ...local.data,
                            id: local.localId?.startsWith('local_') ? crypto.randomUUID() : local.localId
                        };
                        await this.saveAiGeneratedDraft(userId, quizData);
                        return true;
                    } catch (e) {
                        console.error('Failed to sync quiz:', local.localId, e);
                        return false;
                    }
                })
            );

            const syncedCount = results.filter(Boolean).length;
            return { success: true, count: syncedCount };
        } catch (error) {
            console.error('Sync error:', error);
            throw error;
        }
    }

    async getAiGeneratedDraftsForUser(userId: string, limit = 20) {
        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('id, title, description, created_at')
                .eq('user_id', userId)
                .eq('status', 'draft')
                .eq('source_type', 'ai_generated_draft')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            throw error;
        }
    }

    // Save a generated quiz to the database
    async saveQuiz(userId: string, quizData: QuizData, sourceType: string = 'ai_generated') {
        try {
            // 1. Create the quiz record
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    title: quizData.title,
                    description: quizData.description,
                    summary_id: quizData.summary_id,
                    user_id: userId,
                    source_type: sourceType
                })
                .select()
                .single();

            if (quizError) throw quizError;

            // 2. Create the questions
            const questionsToInsert = quizData.questions.map((q, index) => ({
                quiz_id: quiz.id,
                question: q.question,
                options: q.options,
                correct_answer: q.correctAnswer,
                explanation: q.explanation,
                image_url: q.imageUrl,
                order_index: index
            }));

            const { error: questionsError } = await supabase
                .from('quiz_questions')
                .insert(questionsToInsert);

            if (questionsError) throw questionsError;

            return quiz.id;
        } catch (error) {
            throw error;
        }
    }

    // Fetch a quiz and its questions
    async getQuiz(quizId: string) {
        try {
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();

            if (quizError) throw quizError;

            const { data: questions, error: questionsError } = await supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('order_index');

            if (questionsError) throw questionsError;

            return { quiz, questions };
        } catch (error) {
            throw error;
        }
    }

    // Start or resume a quiz attempt
    async startAttempt(quizId: string, userId: string) {
        try {
            // Check for existing unfinished attempt (finished_at is null)
            const { data: existingAttempt } = await supabase
                .from('quiz_attempts')
                .select('*')
                .eq('quiz_id', quizId)
                .eq('user_id', userId)
                .is('finished_at', null)
                .limit(1)
                .maybeSingle();

            if (existingAttempt) {
                // Fetch existing answers for this attempt
                const { data: answers, error: answersError } = await supabase
                    .from('quiz_answers')
                    .select('*')
                    .eq('attempt_id', existingAttempt.id);

                if (answersError) throw answersError;

                return { attempt: existingAttempt, answers: answers || [] };
            }

            // Create new attempt
            const { data: newAttempt, error: createError } = await supabase
                .from('quiz_attempts')
                .insert({
                    quiz_id: quizId,
                    user_id: userId,
                    score: 0,
                    total_questions: 0,
                    started_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createError) throw createError;

            return { attempt: newAttempt, answers: [] };
        } catch (error) {
            throw error;
        }
    }

    // Save a single answer
    async saveAnswer(attemptId: string, questionId: string, selectedOption: number, isCorrect: boolean) {
        try {
            const isDev = process.env.NODE_ENV !== 'production';
            const payload = {
                attempt_id: attemptId,
                question_id: questionId,
                selected_option: selectedOption,
                is_correct: isCorrect,
                created_at: new Date().toISOString()
            };

            if (isDev) {
                console.debug('[quiz_answers] upsert payload', {
                    onConflict: 'attempt_id,question_id',
                    payload,
                });
            }

            // Upsert answer
            const { error: answerError } = await supabase
                .from('quiz_answers')
                .upsert(payload, { onConflict: 'attempt_id, question_id' });

            if (answerError) {
                if (isDev) {
                    console.error('[quiz_answers] upsert error', {
                        code: (answerError as any).code,
                        message: (answerError as any).message,
                        details: (answerError as any).details,
                        hint: (answerError as any).hint,
                        answerError,
                    });
                }
                throw answerError;
            }

        } catch (error) {
            throw error;
        }
    }

    // Finish a quiz attempt
    async finishAttempt(
        attemptId: string,
        score: number,
        totalQuestions: number,
        answers: Json[] // Kept for backward compatibility if needed, but we rely on quiz_answers table now
    ) {
        try {
            const finishedAt = new Date().toISOString();

            // Calculate time taken if needed, or let the frontend pass it. 
            // For now, we'll just mark it completed.

            const { error } = await supabase
                .from('quiz_attempts')
                .update({
                    score: score,
                    total_questions: totalQuestions,
                    finished_at: finishedAt,
                    answers: answers // Optional: store JSON backup
                })
                .eq('id', attemptId);

            if (error) throw error;
        } catch (error) {
            throw error;
        }
    }

    // Submit a quiz attempt (Legacy/Fallback)
    async submitAttempt(
        quizId: string,
        userId: string | null,
        score: number,
        totalQuestions: number,
        answers: Json[],
        startedAt?: string,
        finishedAt?: string,
        timeTakenSeconds?: number
    ) {
        // ... legacy implementation or redirect to finishAttempt if attemptId is known
        // For now keeping as is for backward compatibility or non-logged in users if any
        try {
            const basePayload = {
                quiz_id: quizId,
                user_id: userId,
                score,
                total_questions: totalQuestions,
            };

            const payloadFull = {
                ...basePayload,
                answers,
                started_at: startedAt ?? null,
                finished_at: finishedAt ?? null,
                time_taken_seconds:
                    typeof timeTakenSeconds === 'number' ? timeTakenSeconds : null,
                status: 'completed'
            };

            const { error } = await supabase.from('quiz_attempts').insert(payloadFull);
            if (error) throw error;
        } catch (error) {
            throw error;
        }
    }

    // Get user's quiz history
    async getUserAttempts(userId: string) {
        try {
            const { data, error } = await supabase
                .from('quiz_attempts')
                .select('*, quizzes(title)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    }
}

export const quizService = new QuizService();
