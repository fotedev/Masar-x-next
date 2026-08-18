import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: true,
});

// Navigation APIs (Link, redirect, usePathname, useRouter) are client-side
// only and have been moved to "@/navigation" to keep this file server-safe.
