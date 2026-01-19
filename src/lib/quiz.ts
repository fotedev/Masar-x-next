import { supabase } from './supabase';


export interface QuizData {
    title: string;
    description?: string;
    summary_id?: string | null;
    questions: {
        question: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
        imageUrl?: string;
    }[];
}

export class QuizService {
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
            console.error('Error saving quiz:', error);
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
            console.error('Error fetching quiz:', error);
            throw error;
        }
    }

    // Submit a quiz attempt
    async submitAttempt(
        quizId: string,
        userId: string | null,
        score: number,
        totalQuestions: number,
        answers: any[],
        startedAt?: string,
        finishedAt?: string,
        timeTakenSeconds?: number
    ) {
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
            };

            const tryInsert = async (payload: Record<string, any>) => {
                const { error } = await supabase.from('quiz_attempts').insert(payload);
                if (error) throw error;
            };

            try {
                await tryInsert(payloadFull);
                return;
            } catch (error: any) {
                const message = typeof error?.message === 'string' ? error.message : '';
                const code = error?.code;
                const details = error?.details;
                const hint = error?.hint;

                console.error('Error submitting attempt (full payload):', {
                    message,
                    code,
                    details,
                    hint,
                });

                // PostgREST returns 400 for schema mismatch (missing columns) when migrations aren't applied.
                const looksLikeMissingColumn =
                    code === 'PGRST204' ||
                    code === '42703' ||
                    /column/i.test(message) ||
                    /could not find/i.test(message) ||
                    /schema cache/i.test(message);

                if (!looksLikeMissingColumn) throw error;

                // Retry with fewer optional fields for backward compatibility.
                try {
                    await tryInsert({ ...basePayload, answers });
                    return;
                } catch (error2: any) {
                    const message2 = typeof error2?.message === 'string' ? error2.message : '';
                    const code2 = error2?.code;
                    const details2 = error2?.details;
                    const hint2 = error2?.hint;

                    console.error('Error submitting attempt (retry with answers):', {
                        message: message2,
                        code: code2,
                        details: details2,
                        hint: hint2,
                    });

                    const stillMissingColumn =
                        code2 === 'PGRST204' ||
                        code2 === '42703' ||
                        /column/i.test(message2) ||
                        /could not find/i.test(message2) ||
                        /schema cache/i.test(message2);

                    if (!stillMissingColumn) throw error2;

                    await tryInsert(basePayload);
                    return;
                }
            }
        } catch (error) {
            console.error('Error submitting attempt:', error);
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
            console.error('Error fetching attempts:', error);
            throw error;
        }
    }
}

export const quizService = new QuizService();
