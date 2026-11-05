import { QuizPlayer } from "@/components/QuizPlayer";
import { PreloadKatex } from "@/components/quiz/PreloadKatex";
import { createClient } from "@/lib/supabase/server";

/**
 * Spec 033 Track A (perf audit SPLIT-3 / spec-032 deferral): the quiz
 * payload is fetched server-side so the start card renders in the first
 * HTML paint instead of waiting for hydration + two serial client queries
 * (measured LCP 5.58s before). The cookie-bound anon/authed server client
 * keeps RLS intact — anon sees approved quizzes only; attempts stay
 * client-side, so guests still create nothing.
 */
export default async function QuizPlayPage({
  params,
}: {
  params: Promise<{ locale: string; quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();

  const [quizResult, questionsResult] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).single(),
    supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index"),
  ]);

  // null payload → QuizPlayer's existing not-found/retry UI (client-side
  // getQuiz retry can still succeed if the server read failed transiently).
  const initialQuiz =
    quizResult.data && !questionsResult.error
      ? { quiz: quizResult.data, questions: questionsResult.data ?? [] }
      : null;

  return (
    <>
      <PreloadKatex />
      <QuizPlayer quizId={quizId} initialQuiz={initialQuiz} />
    </>
  );
}
