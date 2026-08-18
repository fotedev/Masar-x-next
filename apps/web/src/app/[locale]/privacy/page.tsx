"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

export default function PrivacyPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common");

  useEffect(() => {
    router.replace(`/${locale}/privacy-policy`);
  }, [router, locale]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">
          {t("redirectingToPrivacyPolicy")}
        </p>
      </div>
    </div>
  );
}
