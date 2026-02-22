import { createClient } from "@supabase/supabase-js";
import { MetadataRoute } from "next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const baseUrl = "https://masarx.vercel.app";

const staticPaths = [
  "",
  "/add",
  "/add-file",
  "/add-summary",
  "/add-video",
  "/admin-dashboard",
  "/ai-assistant",
  "/courses",
  "/edit-summary",
  "/faq",
  "/instructor-dashboard",
  "/login",
  "/news",
  "/privacy",
  "/privacy-details",
  "/privacy-policy",
  "/profile",
  "/quiz-attempts",
  "/quiz-play",
  "/quizzes",
  "/reset-password",
  "/signup",
  "/subjects",
  "/summaries",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: today,
    changeFrequency: "daily",
    priority: path === "" ? 1.0 : 0.8,
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
