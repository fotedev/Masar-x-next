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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheGet, cacheSet } from "../read-cache";

const GUEST_RESULTS_CACHE_PREFIX = "quiz_guest_result:";

export async function fetchQuizWithQuestions(
  supabase: SupabaseClient,
  quizId: string,
): Promise<{
  title: string;
  description: string | null;
  durationSeconds: number | null;
  questions: PlayerQuestion[];
}> {
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, description, duration_seconds")
    .eq("id", quizId)
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      duration_seconds: number | null;
    }>();
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
    durationSeconds: typeof quiz.duration_seconds === "number" ? quiz.duration_seconds : null,
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

/** Per-question answer payload written into the attempt's `answers` jsonb (web parity). */
export interface AttemptAnswerPayload {
  question_id: string;
  selected_option: number;
  is_correct: boolean;
}

/**
 * Finish the attempt (spec 019 C6/T095): now also writes
 * `time_taken_seconds` and the `answers` jsonb — the exact columns the
 * web finish flow writes, so the attempts history (web /quiz-attempts
 * and the new mobile QuizAttemptsScreen) can review per-question
 * answers without joining quiz_answers.
 */
export async function finishAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  score: number,
  totalQuestions: number,
  details: {
    timeTakenSeconds?: number | null;
    answers?: AttemptAnswerPayload[];
  } = {},
): Promise<void> {
  const { error } = await supabase
    .from("quiz_attempts")
    .update({
      score,
      total_questions: totalQuestions,
      finished_at: new Date().toISOString(),
      status: "completed",
      ...(details.timeTakenSeconds != null
        ? { time_taken_seconds: details.timeTakenSeconds }
        : {}),
      ...(details.answers ? { answers: details.answers } : {}),
    })
    .eq("id", attemptId);
  if (error) throw error;
}

export interface GuestAnswerEntry {
  questionId: string;
  selected: number;
  isCorrect: boolean;
}

/**
 * Local guest attempt (spec 019 C6/T096). Extended with title,
 * timeTakenSeconds and per-question answers so guest attempts remain
 * fully reviewable offline. All fields optional for backward
 * compatibility with results stored before spec 019.
 */
export interface GuestResult {
  quizId: string;
  score: number;
  total: number;
  finishedAt: string;
  title?: string;
  timeTakenSeconds?: number | null;
  answers?: GuestAnswerEntry[];
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

export interface GuestResultEntry {
  quizId: string;
  result: GuestResult;
}

/**
 * Enumerate on-device guest results for the attempts history
 * (spec §2.5): an AsyncStorage key scan over the
 * `quiz_guest_result:` prefix. One entry per quiz (the latest attempt
 * — the cache key is per-quiz). Malformed/legacy entries are skipped.
 */
export async function listGuestResults(): Promise<GuestResultEntry[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await Promise.all(
      keys
        .filter((key) => key.startsWith(GUEST_RESULTS_CACHE_PREFIX))
        .map(async (key) => {
          const hit = await cacheGet<GuestResult>(key);
          if (!hit?.payload || typeof hit.payload.quizId !== "string") return null;
          return { quizId: hit.payload.quizId, result: hit.payload } satisfies GuestResultEntry;
        }),
    );
    return entries.filter((entry): entry is GuestResultEntry => entry !== null);
  } catch {
    return [];
  }
}