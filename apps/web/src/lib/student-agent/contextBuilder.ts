import type { StudentAcademicScope, StudentAgentSource } from "@/lib/student-agent/platformRetriever";
import {
  fetchRecentNews,
  fetchStudentQuizzes,
  fetchStudentSubjects,
  fetchStudentSummaries,
  fetchStudentVideos,
} from "@/lib/student-agent/platformRetriever";

export type StudentAgentContextResult = {
  context: string;
  sources: Array<{ source_id: string; title: string }>;
};

const MAX_CONTEXT_CHARS = 4000;

const safeSection = (title: string, lines: string[]) => {
  const content = lines.filter(Boolean).join("\n");
  if (!content.trim()) return "";
  return `\n\n## ${title}\n${content}`;
};

const clamp = (text: string, maxChars: number) => {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
};

const formatItem = (item: StudentAgentSource) => {
  const meta = item.meta || {};
  const metaParts: string[] = [];

  if (typeof meta.subject === "string" && meta.subject.trim()) metaParts.push(`المادة: ${meta.subject}`);
  if (typeof meta.level === "number") metaParts.push(`المستوى: ${meta.level}`);
  if (typeof meta.semester === "number") metaParts.push(`الترم: ${meta.semester}`);
  if (typeof meta.year === "string" && meta.year.trim()) metaParts.push(`السنة: ${meta.year}`);
  if (typeof meta.department === "string" && meta.department.trim()) metaParts.push(`القسم: ${meta.department}`);

  const metaSuffix = metaParts.length > 0 ? ` (${metaParts.join("، ")})` : "";
  const urlSuffix = item.url ? `\nالرابط: ${item.url}` : "";

  return `- ${item.title}${metaSuffix}\n${item.snippet}${urlSuffix}`.trim();
};

export async function buildStudentContext(
  academic: StudentAcademicScope,
  query: string,
): Promise<StudentAgentContextResult> {
  const [subjects, quizzes, summaries, videos, news] = await Promise.all([
    fetchStudentSubjects(academic, query),
    fetchStudentQuizzes(academic, query),
    fetchStudentSummaries(academic, query),
    fetchStudentVideos(academic, query),
    fetchRecentNews(query),
  ]);

  const sources: Array<{ source_id: string; title: string }> = [];
  const addSources = (items: StudentAgentSource[]) => {
    for (const i of items) {
      sources.push({ source_id: i.source_id, title: i.title });
    }
  };

  addSources(subjects);
  addSources(quizzes);
  addSources(summaries);
  addSources(videos);
  addSources(news);

  const contextParts: string[] = [];

  contextParts.push(
    `سياق الطالب (حسب بيانات المنصة):\n- المستوى: ${academic.level ?? "غير محدد"}\n- الترم: ${academic.semester ?? "غير محدد"}`,
  );

  contextParts.push(
    safeSection(
      "مواد الطالب",
      subjects.map(formatItem),
    ),
  );

  contextParts.push(
    safeSection(
      "اختبارات معتمدة",
      quizzes.map(formatItem),
    ),
  );

  contextParts.push(
    safeSection(
      "ملخصات معتمدة",
      summaries.map(formatItem),
    ),
  );

  contextParts.push(
    safeSection(
      "فيديوهات",
      videos.map(formatItem),
    ),
  );

  contextParts.push(
    safeSection(
      "آخر الأخبار (نشطة)",
      news.map(formatItem),
    ),
  );

  const raw = contextParts.filter(Boolean).join("");
  const context = clamp(raw, MAX_CONTEXT_CHARS);

  return {
    context,
    sources,
  };
}
