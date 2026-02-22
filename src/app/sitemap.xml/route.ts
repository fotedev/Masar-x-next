import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const baseUrl = "https://masarx.vercel.app";
  
  // Static URLs
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

  let dynamicUrls = "";

  try {
    // Fetch subjects
    const { data: subjects } = await supabase
      .from("subjects")
      .select("name");

    if (subjects) {
      subjects.forEach((subject) => {
        const encodedName = encodeURIComponent(subject.name.trim());
        dynamicUrls += `<url><loc>${baseUrl}/subjects/${encodedName}</loc><lastmod>${new Date().toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      });
    }

    // Fetch courses
    const { data: courses } = await supabase
      .from("courses")
      .select("id, updated_at");

    if (courses) {
      courses.forEach((course) => {
        dynamicUrls += `<url><loc>${baseUrl}/courses/${course.id}</loc><lastmod>${new Date(course.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      });
    }

    // Fetch summaries
    const { data: summaries } = await supabase
      .from("summaries")
      .select("id, updated_at")
      .eq("status", "approved");

    if (summaries) {
      summaries.forEach((summary) => {
        dynamicUrls += `<url><loc>${baseUrl}/summaries/${summary.id}</loc><lastmod>${new Date(summary.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
      });
    }
  } catch (error) {
    console.error("Sitemap generation error:", error);
  }

  const staticUrls = staticPaths
    .map(
      (path) => `<url><loc>${baseUrl}${path}</loc><lastmod>${new Date().toISOString().split("T")[0]}</lastmod><changefreq>daily</changefreq><priority>${path === "" ? "1.0" : "0.8"}</priority></url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${dynamicUrls}</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
