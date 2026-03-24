import { defineRouting } from "next-intl/routing";
import { createNavigation } from 'next-intl/navigation';

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: true,
});

// Lightweight wrappers around Next.js navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
