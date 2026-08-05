"use client";

import { Globe } from "lucide-react";
import { useCallback } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

type Locale = "ar" | "en";

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  const toggle = useCallback(() => {
    const next: Locale = locale === "ar" ? "en" : "ar";
    router.replace(pathname, { locale: next });
  }, [locale, pathname, router]);

  const nextLabel = locale === "ar" ? "EN" : "AR";
  const ariaLabel = t("changeLanguageAriaLabel");

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all duration-200"
      aria-label={ariaLabel}
      title={ariaLabel}
      type="button"
    >
      <Globe className="w-4 h-4" />
      <span className="font-bold tracking-wide">{nextLabel}</span>
    </button>
  );
}
