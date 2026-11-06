"use client";

import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { isStubSubject, type DriveSubject } from "@/lib/materials";
import { SubjectIcon } from "./SubjectIcon";

type Props = {
  subjects: DriveSubject[];
  fileCount: (subject: DriveSubject) => number;
  onSelect: (slug: string) => void;
};

export function SubjectGrid({ subjects, fileCount, onSelect }: Props) {
  const t = useTranslations("materials");
  const locale = useLocale();

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="materials-subject-grid"
    >
      {subjects.map((subject) => {
        const name = locale === "ar" ? subject.nameAr : subject.name;
        const stub = isStubSubject(subject);
        return (
          <button
            key={subject.slug}
            type="button"
            onClick={() => onSelect(subject.slug)}
            data-testid="materials-subject-card"
            data-slug={subject.slug}
            className="text-start rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-brand-blue hover:shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-blue"
          >
            <div className="flex items-start gap-x-3">
              <span className="shrink-0 rounded-xl bg-brand-blue/10 text-brand-blue p-2.5">
                <SubjectIcon icon={subject.icon} className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white truncate">
                  {name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t("term", { level: subject.level, semester: subject.semester })}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
              {stub ? (
                <span className="inline-flex items-center gap-x-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5">
                  <Clock className="w-3 h-3" aria-hidden />
                  {t("comingSoonTitle")}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                  {t("fileCount", { count: fileCount(subject) })}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
