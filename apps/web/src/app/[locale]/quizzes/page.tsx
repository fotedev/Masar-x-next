import { QuizDashboard } from "./_components/QuizDashboard";
import { createClient } from "@/lib/supabase/server";
import type { Quiz } from "@/types/database";

/**
 * Spec 033 Track B (perf audit FETCH-2/SPLIT-3): the quizzes dashboard
 * previously mounted client-only behind an ssr:false wrapper and swapped
 * spinner → skeleton → grid after hydration (measured CLS 0.798). The
 * page now server-fetches the default approved view (RLS `baseline.sql:4173`
 * for anon; the explicit status filter matches the client's non-admin
 * default even when the cookie carries a session) and seeds the dashboard.
 *
 * `.limit(60)` implements audit FETCH-2's recommendation for the student
 * view (unbounded full-table select); admins client-refresh without the
 * limit once isAdmin resolves.
 */
export default async function QuizzesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("quizzes")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(60);

  return <QuizDashboard initialQuizzes={(data as Quiz[]) ?? null} />;
}
