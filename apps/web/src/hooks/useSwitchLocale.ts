"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/navigation";

type Locale = "ar" | "en";

/**
 * Soft locale switch shared by every language toggle (header, mobile nav,
 * admin sidebar) — spec 041 P1.7: one implementation instead of three
 * verbatim copies that could drift.
 *
 * <html lang/dir> is server-rendered; flip it immediately so the layout
 * direction follows a soft locale switch without a full reload.
 */
export function useSwitchLocale() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(() => {
    const next: Locale = locale === "ar" ? "en" : "ar";
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    router.replace(pathname, { locale: next });
  }, [locale, pathname, router]);
}
