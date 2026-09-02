/**
 * Mobile quiz service - mirrors apps/web/src/lib/quiz.ts calls against
 * the SAME Supabase tables (quiz_attempts, quiz_answers) so attempts
 * started on mobile continue on web and vice versa (spec US2 / US4).
 *
 * Guest behavior matches the web: attempts run locally and results are
 * kept on-device only (read-cache), never written anonymously.
 */
import type { SupabaseClient } from "masarx-shared/supabase";

import type {
  PlayerQuestion,
  QuizAnswerRow,
  QuizAttemptRow,
} from "../types/quiz";
import { cacheGet, cacheSet } from "../read-cache";

const GUEST_RESULTS_CACHE_PREFIX = "quiz_guest_result:";

export async function fetchQuizWithQuestions(
  supabase: SupabaseClient,
  quizId: string,
): Promise<{ title: string; description: string | null; questions: PlayerQuestion[] }> {
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, description")
    .eq("id", quizId)
    .maybeSingle<{ id: string; title: string; description: string | null }>();
  if (quizError) throw quizError;
  if (!quiz) throw new Error("quiz_not_found");

  const { data: questions, error: questionsError } = await supabase
    .from("quiz_questions")
    .select("id, quiz_id, question, options, correct_answer, explanation, image_url, order_index")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });
  if (questionsError) throw questionsError;

  const rows = (questions ?? []) as Array<{
    id: string;
    quiz_id: string;
    question: string;
    options: string[] | null;
    correct_answer: number;
    explanation: string | null;
    image_url: string | null;
    order_index: number;
  }>;

  return {
    title: quiz.title,
    description: quiz.description,
    questions: rows.map((row) => ({
      id: row.id,
      question: row.question,
      options: Array.isArray(row.options) ? row.options : [],
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
    })),
  };
}

/** Start (or resume) the signed-in user's open attempt, mirroring the web. */
export async function startAttempt(
  supabase: SupabaseClient,
  quizId: string,
  userId: string,
): Promise<QuizAttemptRow> {
  const { data: existing, error: existingError } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .is("finished_at", null)
    .limit(1)
    .maybeSingle<QuizAttemptRow>();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      user_id: userId,
      score: 0,
      total_questions: 0,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single<QuizAttemptRow>();
  if (createError) throw createError;
  return created;
}

export async function saveAnswer(
  supabase: SupabaseClient,
  attemptId: string,
  questionId: string,
  selectedOption: number,
  isCorrect: boolean,
): Promise<void> {
  const payload: QuizAnswerRow = {
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: selectedOption,
    is_correct: isCorrect,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("quiz_answers")
    .upsert(payload, { onConflict: "attempt_id,question_id" });
  if (error) throw error;
}

export async function finishAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  score: number,
  totalQuestions: number,
): Promise<void> {
  const { error } = await supabase
    .from("quiz_attempts")
    .update({
      score,
      total_questions: totalQuestions,
      finished_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", attemptId);
  if (error) throw error;
}

export interface GuestResult {
  quizId: string;
  score: number;
  total: number;
  finishedAt: string;
}

/** Guest results stay on-device (parity with the web's sessionStorage flow). */
export async function saveGuestResult(quizId: string, result: GuestResult): Promise<void> {
  await cacheSet(`${GUEST_RESULTS_CACHE_PREFIX}${quizId}`, result, 24 * 30);
}

export async function getGuestResult(quizId: string): Promise<GuestResult | null> {
  return cacheGet<GuestResult>(`${GUEST_RESULTS_CACHE_PREFIX}${quizId}`).then(
    (hit) => hit?.payload ?? null,
  );
}