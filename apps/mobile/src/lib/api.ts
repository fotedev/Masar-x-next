// Typed data layer mirroring the web app's exact queries
// (see .cluster/masarx-native/web-inventory.md for the web sources).
import { supabase } from "./supabase";
import type { Subject, Summary, Quiz, News, Profile, SubjectLecture } from "@masarx-shared/types";

export type SummaryWithRatings = Summary & {
  avg_rating?: number | null;
  reviews_count?: number | null;
  subject_name?: string | null;
};

export type PlatformSettings = { activeSemester: number };

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  // Mirrors PlatformSettingsContext on web (tolerates missing row → default 1).
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .eq("key", "active_semester")
    .limit(1)
    .maybeSingle();
  if (error || !data) return { activeSemester: 1 };
  const value = data.value as { semester?: number } | null;
  return { activeSemester: Number(value?.semester) || 1 };
}

export async function fetchSubjects(opts: { level?: number | null; semester?: number | null }): Promise<Subject[]> {
  // Mirrors useSubjects + SubjectsGrid on web: academic subjects for the
  // user's level, filtered to the active semester and show_on_home.
  let query = supabase
    .from("subjects")
    .select(
      "id,name,name_en,is_academic,semester,level,show_on_home,created_at,professor,description,schedule,location,status",
    )
    .eq("is_academic", true)
    .order("name", { ascending: true });
  if (typeof opts.level === "number" && opts.level > 0) query = query.eq("level", opts.level);
  if (typeof opts.semester === "number" && opts.semester > 0) query = query.eq("semester", opts.semester);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Subject[];
  return rows.filter((s) => s.show_on_home !== false);
}

export async function fetchSubjectByName(name: string): Promise<Subject | null> {
  const { data, error } = await supabase.from("subjects").select("*").eq("name", name).maybeSingle();
  if (error) throw error;
  return (data as Subject) ?? null;
}

export async function fetchLectures(subject: string): Promise<SubjectLecture[]> {
  const { data, error } = await supabase
    .from("subject_lectures")
    .select("*")
    .eq("subject", subject)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubjectLecture[];
}

export type LectureContent = {
  summaries: Array<{ id: string; title: string; lecture_key?: string | null; lecture_id?: string | null }>;
  videos: Array<{ id: string; title: string; url: string; lecture_key?: string | null; lecture_id?: string | null }>;
  files: Array<{ id: string; title: string; file_url: string; description?: string | null; lecture_key?: string | null; lecture_id?: string | null }>;
  quizzes: Array<{ id: string; title: string; lecture_id?: string | null }>;
};

export async function fetchLectureContent(subject: string): Promise<LectureContent> {
  // Same shape/limits as the web's useLectureContent; matched per-lecture
  // client-side by lecture_id → lecture_key.
  const [summaries, videos, files, quizzes] = await Promise.all([
    supabase
      .from("summaries")
      .select("id,title,subject,status,created_at,lecture_key,lecture_id")
      .eq("subject", subject)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("videos")
      .select("id,title,subject,url,language,created_at,lecture_key,lecture_id")
      .eq("subject", subject)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("files")
      .select("id,title,subject,file_url,description,created_at,lecture_key,lecture_id")
      .eq("subject", subject)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("quizzes")
      .select("id,title,subject,description,created_at,lecture_id,status")
      .eq("subject", subject)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return {
    summaries: (summaries.data ?? []) as LectureContent["summaries"],
    videos: (videos.data ?? []) as LectureContent["videos"],
    files: (files.data ?? []) as LectureContent["files"],
    quizzes: (quizzes.data ?? []) as LectureContent["quizzes"],
  };
}

export async function fetchUserProgressIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("user_progress").select("content_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { content_id: string }) => r.content_id));
}

export async function toggleUserProgress(userId: string, contentId: string, done: boolean): Promise<void> {
  if (done) {
    const { error } = await supabase.from("user_progress").insert({ user_id: userId, content_id: contentId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_progress")
      .delete()
      .eq("user_id", userId)
      .eq("content_id", contentId);
    if (error) throw error;
  }
}

export async function fetchTopSummaries(limit = 20): Promise<SummaryWithRatings[]> {
  const { data, error } = await supabase
    .from("summaries_with_ratings")
    .select("*")
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SummaryWithRatings[];
}

export async function fetchSummaryById(id: string): Promise<Summary | null> {
  const { data, error } = await supabase
    .from("summaries")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw error;
  return (data as Summary) ?? null;
}

export async function fetchProfileById(id: string): Promise<Pick<Profile, "full_name" | "avatar_url"> | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name,avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data as { full_name: string | null; avatar_url: string | null } | null;
}

export async function fetchNews(limit = 30): Promise<News[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as News[];
}

export async function fetchApprovedQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Quiz[];
}

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string | null;
  image_url?: string | null;
  order_index: number;
};

export async function fetchQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
  }>;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function upsertProfileFields(fields: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(fields, { onConflict: "id" });
  if (error) throw error;
}
