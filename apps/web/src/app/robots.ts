import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

// Spec 052: generated robots route (replaces public/robots.txt) so the
// sitemap URL follows NEXT_PUBLIC_SITE_URL — each faculty deployment is
// its own indexed site. Next.js serves this at /robots.txt, which the
// proxy matcher already excludes (no locale redirect).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Private and low-value pages
          "/admin*",
          "/instructor-dashboard",
          "/profile",
          "/login",
          "/signup",
          "/reset-password",
          "/add",
          "/add-file",
          "/add-video",
          "/edit-summary",
          "/quiz-play",
          "/quiz-attempts",
          // Development files
          "/src/",
          "/node_modules/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
