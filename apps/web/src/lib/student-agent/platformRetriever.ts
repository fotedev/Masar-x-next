import { supabase } from "@/lib/supabase";
import { queryCache } from "@/lib/queryCache";

export type StudentAcademicScope = {
  level: number | null;
  semester: number | null;
  department_id?: string | null;
};

export type StudentAgentSource = {
  source_id: string;
  title: string;
  snippet: string;
  meta?: Record<string, unknown>;
  url?: string;
};

const TTL_MS = 5 * 60 * 1000;
const MAX_RESULTS_PER_CATEGORY = 8;
const MAX_SNIPPET_CHARS = 500;

const truncate = (text: string, maxChars: number) => {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
};

const normalizeQuery = (query: string) => query.trim();

const getKeywordTokens = (query: string) => {
  const q = normalizeQuery(query);
  if (!q) return [];

  const cleaned = q
    .replace(/[()\[\]{}:,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .split(/\s+/)
    .map((t) => t.trim().replace(/[^\p{L}\p{N}_-]+/gu, ""))
    .filter((t) => t.length >= 3)
    .slice(0, 5);
};

const buildOrIlikeFilter = (column: string, tokens: string[]) => {
  const safeTokens = tokens.filter(Boolean);
  if (safeTokens.length === 0) return null;
  return safeTokens.map((t) => `${column}.ilike.*${t}*`).join(",");
};

export async function fetchStudentSubjects(academic: StudentAcademicScope, query?: string) {
  const cacheKey = `student_agent:subjects:lvl:${academic.level ?? "null"}:sem:${academic.semester ?? "null"}:q:${(query || "").toLowerCase()}`;
  const cached = queryCache.get<StudentAgentSource[]>(cacheKey);
  if (cached) return cached;

  const tokens = getKeywordTokens(query || "");

  let q = supabase
    .from("subjects")
    .select("id,name,description,professor,level,semester")
    .order("name", { ascending: true })
    .limit(MAX_RESULTS_PER_CATEGORY);

  if (typeof academic.level === "number") q = q.eq("level", academic.level);
  if (typeof academic.semester === "number") q = q.eq("semester", academic.semester);

  const orFilter = buildOrIlikeFilter("name", tokens);
  if (orFilter) q = q.or(orFilter);

  const { data, error } = await q;
  if (error) throw error;

  const items: StudentAgentSource[] = (data || []).map(
    (s: (typeof data)[number]) => ({
    source_id: `subject:${s.id}`,
    title: s.name,
    snippet: truncate(String(s.description || ""), MAX_SNIPPET_CHARS),
    meta: {
      professor: s.professor,
      level: s.level,
      semester: s.semester,
    },
    }),
  );

  queryCache.set(cacheKey, items, TTL_MS);
  return items;
}

export async function fetchStudentQuizzes(academic: StudentAcademicScope, query?: string) {
  const cacheKey = `student_agent:quizzes:lvl:${academic.level ?? "null"}:sem:${academic.semester ?? "null"}:q:${(query || "").toLowerCase()}`;
  const cached = queryCache.get<StudentAgentSource[]>(cacheKey);
  if (cached) return cached;

  const tokens = getKeywordTokens(query || "");

  let q = supabase
    .from("quizzes")
    .select("id,title,description,subject,level,semester,created_at,status")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS_PER_CATEGORY);

  if (typeof academic.level === "number") q = q.eq("level", academic.level);
  if (typeof academic.semester === "number") q = q.eq("semester", academic.semester);

  const orFilter = buildOrIlikeFilter("title", tokens);
  if (orFilter) q = q.or(orFilter);

  const { data, error } = await q;
  if (error) throw error;

  const items: StudentAgentSource[] = (data || []).map(
    (quiz: (typeof data)[number]) => ({
    source_id: `quiz:${quiz.id}`,
    title: quiz.title,
    snippet: truncate(String(quiz.description || ""), MAX_SNIPPET_CHARS),
    meta: {
      subject: quiz.subject,
      level: quiz.level,
      semester: quiz.semester,
      created_at: quiz.created_at,
    },
    }),
  );

  queryCache.set(cacheKey, items, TTL_MS);
  return items;
}

export async function fetchStudentSummaries(academic: StudentAcademicScope, query?: string) {
  const cacheKey = `student_agent:summaries:lvl:${academic.level ?? "null"}:sem:${academic.semester ?? "null"}:q:${(query || "").toLowerCase()}`;
  const cached = queryCache.get<StudentAgentSource[]>(cacheKey);
  if (cached) return cached;

  const tokens = getKeywordTokens(query || "");

  let q = supabase
    .from("summaries_with_ratings")
    .select("id,title,subject,year,department,content,created_at,avg_rating,reviews_count,status,pdf_url")
    .eq("status", "approved")
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS_PER_CATEGORY);

  const orFilter = buildOrIlikeFilter("title", tokens);
  if (orFilter) q = q.or(orFilter);

  const { data, error } = await q;
  if (error) throw error;

  const items: StudentAgentSource[] = (data || []).map(
    (s: (typeof data)[number]) => ({
    source_id: `summary:${s.id}`,
    title: s.title,
    snippet: truncate(String(s.content || ""), MAX_SNIPPET_CHARS),
    meta: {
      subject: s.subject,
      year: s.year,
      department: s.department,
      avg_rating: s.avg_rating,
      reviews_count: s.reviews_count,
      created_at: s.created_at,
    },
    url: s.pdf_url || undefined,
    }),
  );

  queryCache.set(cacheKey, items, TTL_MS);
  return items;
}

export async function fetchStudentVideos(academic: StudentAcademicScope, query?: string) {
  const cacheKey = `student_agent:videos:lvl:${academic.level ?? "null"}:sem:${academic.semester ?? "null"}:q:${(query || "").toLowerCase()}`;
  const cached = queryCache.get<StudentAgentSource[]>(cacheKey);
  if (cached) return cached;

  const tokens = getKeywordTokens(query || "");

  let q = supabase
    .from("videos")
    .select("id,title,subject,url,language,created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS_PER_CATEGORY);

  const orTitle = buildOrIlikeFilter("title", tokens);
  const orSubject = buildOrIlikeFilter("subject", tokens);
  const orParts = [orTitle, orSubject].filter(Boolean);
  if (orParts.length > 0) q = q.or(orParts.join(","));

  const { data, error } = await q;
  if (error) throw error;

  const items: StudentAgentSource[] = (data || []).map(
    (v: (typeof data)[number]) => ({
    source_id: `video:${v.id}`,
    title: v.title,
    snippet: truncate(String(v.subject || ""), MAX_SNIPPET_CHARS),
    meta: {
      subject: v.subject,
      language: v.language,
      created_at: v.created_at,
    },
    url: v.url,
    }),
  );

  queryCache.set(cacheKey, items, TTL_MS);
  return items;
}

export async function fetchRecentNews(query?: string) {
  const cacheKey = `student_agent:news:active:q:${(query || "").toLowerCase()}`;
  const cached = queryCache.get<StudentAgentSource[]>(cacheKey);
  if (cached) return cached;

  const tokens = getKeywordTokens(query || "");

  let q = supabase
    .from("news")
    .select("id,title,content,type,priority,created_at,subject,department,year,is_active,file_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS_PER_CATEGORY);

  const orFilter = buildOrIlikeFilter("title", tokens);
  if (orFilter) q = q.or(orFilter);

  const { data, error } = await q;
  if (error) throw error;

  const items: StudentAgentSource[] = (data || []).map(
    (n: (typeof data)[number]) => ({
    source_id: `news:${n.id}`,
    title: n.title,
    snippet: truncate(String(n.content || ""), MAX_SNIPPET_CHARS),
    meta: {
      type: n.type,
      priority: n.priority,
      created_at: n.created_at,
      subject: n.subject,
      department: n.department,
      year: n.year,
    },
    url: n.file_url || undefined,
    }),
  );

  queryCache.set(cacheKey, items, TTL_MS);
  return items;
}
