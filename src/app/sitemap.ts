import { createClient } from "@supabase/supabase-js";
import { MetadataRoute } from "next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const baseUrl = "https://masarx.vercel.app";

const staticPaths = [
  { path: "", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/subjects", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/summaries", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/quizzes", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/courses", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/news", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((item) => ({
    url: `${baseUrl}${item.path}`,
    lastModified: today,
    changeFrequency: item.changeFrequency,
    priority: item.priority,
  }));

  let dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const [subjectsRes, coursesRes, summariesRes] = await Promise.all([
      supabase.from("subjects").select("name"),
      supabase.from("courses").select("id, updated_at"),
      supabase.from("summaries").select("id, updated_at").eq("status", "approved"),
    ]);

    const subjects = subjectsRes.data;
    const courses = coursesRes.data;
    const summaries = summariesRes.data;

    if (subjects) {
      dynamicEntries.push(
        ...subjects.map((s) => ({
          url: `${baseUrl}/subjects/${encodeURIComponent(s.name.trim())}`,
          lastModified: today,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }))
      );
    }

    if (courses) {
      dynamicEntries.push(
        ...courses.map((c) => ({
          url: `${baseUrl}/courses/${c.id}`,
          lastModified: new Date(c.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }))
      );
    }

    if (summaries) {
      dynamicEntries.push(
        ...summaries.map((s) => ({
          url: `${baseUrl}/summaries/${s.id}`,
          lastModified: new Date(s.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }))
      );
    }
  } catch (error) {
    console.error("Sitemap generation error:", error);
  }

  return [...staticEntries, ...dynamicEntries];
}
