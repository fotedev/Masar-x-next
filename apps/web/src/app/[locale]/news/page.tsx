import NewsClient from "./_components/NewsClient";
import { createClient } from "@/lib/supabase/server";
import type { News } from "@/types/database";

/**
 * Spec 034 Track A (perf audit FETCH/SPLIT-3 family; spec 033 acceptance
 * finding): news cards mounted client-side and grew post-hydration,
 * shifting the footer (measured CLS 0.490 ×5). The page now server-fetches
 * the public active view — identical filter to useNews's default query —
 * and seeds the client via TanStack initialData. No academic gating on
 * this content, so the quizzes-SSR wall does not apply here.
 */
export default async function NewsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("news")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);

  return <NewsClient initialNews={(data as News[]) ?? null} />;
}
