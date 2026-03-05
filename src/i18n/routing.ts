import {defineRouting} from "next-intl/routing";
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: true,
});

// Lightweight wrappers around Next.js navigation APIs
// that will consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
