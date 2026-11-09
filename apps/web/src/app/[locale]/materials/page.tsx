"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, FileText } from "lucide-react";
import { isStubSubject, type DriveGroup } from "@/lib/materials";
import { useMaterialsData } from "./_hooks/useMaterialsData";
import { SubjectGrid } from "./_components/SubjectGrid";
import { SubjectIcon } from "./_components/SubjectIcon";
import { GroupChips } from "./_components/GroupChips";
import { DriveViewer } from "./_components/DriveViewer";

export default function MaterialsPage() {
  const t = useTranslations("materials");
  const locale = useLocale();
  const { filteredSubjects, fileCount } = useMaterialsData();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeChildIndex, setActiveChildIndex] = useState<number | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);

  const selected = useMemo(
    () => filteredSubjects.find((s) => s.slug === selectedSlug) ?? null,
    [filteredSubjects, selectedSlug],
  );

  const selectSubject = (slug: string) => {
    const subject = filteredSubjects.find((s) => s.slug === slug);
    setSelectedSlug(slug);
    // Stubs (no Drive folder) go straight to the coming-soon state; real
    // subjects auto-select their first group so the browser is useful at once.
    setActiveGroupIndex(subject && !isStubSubject(subject) && subject.groups.length > 0 ? 0 : null);
    setActiveChildIndex(null);
    setActiveFileIndex(null);
  };

  const backToSubjects = () => {
    setSelectedSlug(null);
    setActiveGroupIndex(null);
    setActiveChildIndex(null);
    setActiveFileIndex(null);
  };

  const activeGroup: DriveGroup | undefined =
    selected && activeGroupIndex !== null
      ? selected.groups[activeGroupIndex]
      : undefined;
  const activeChild =
    activeGroup && activeChildIndex !== null
      ? activeGroup.children?.[activeChildIndex]
      : undefined;
  const currentFolder = activeChild ?? activeGroup;
  const files = currentFolder?.files ?? [];
  const activeFile = activeFileIndex !== null ? files[activeFileIndex] : undefined;

  const subjectName =
    selected && (locale === "ar" ? selected.nameAr : selected.name);

  return (
    <div className="space-y-8" data-testid="materials-page">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          {t("title")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {t("description")}
        </p>
      </div>

      {!selected && (
        <SubjectGrid
          subjects={filteredSubjects}
          fileCount={fileCount}
          onSelect={selectSubject}
        />
      )}

      {selected && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={backToSubjects}
              className="inline-flex items-center gap-x-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-brand-blue"
            >
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("backToSubjects")}
            </button>
            <div className="flex items-center gap-x-2 min-w-0">
              <span className="shrink-0 rounded-xl bg-brand-blue/10 text-brand-blue p-1.5">
                <SubjectIcon icon={selected.icon} className="w-4 h-4" />
              </span>
              <h2 className="min-w-0 truncate font-bold text-slate-900 dark:text-white">
                {subjectName}
              </h2>
            </div>
          </div>

          {isStubSubject(selected) ? (
            <div
              className="modern-card p-10 text-center"
              data-testid="materials-coming-soon"
            >
              <Clock className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                {t("comingSoonTitle")}
              </h3>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {t("comingSoonBody")}
              </p>
            </div>
          ) : (
            <>
              <GroupChips
                groups={selected.groups}
                activeGroupIndex={activeGroupIndex}
                activeChildIndex={activeChildIndex}
                onSelectGroup={(i) => {
                  setActiveGroupIndex(i);
                  setActiveChildIndex(null);
                  setActiveFileIndex(null);
                }}
                onSelectChild={(i) => {
                  setActiveChildIndex(i);
                  setActiveFileIndex(null);
                }}
              />

              {files.length === 0 ? (
                <p className="modern-card p-6 text-center text-slate-500 dark:text-slate-400">
                  {t("emptyGroup")}
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <ul className="modern-card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {files.map((file, i) => (
                      <li key={file.fileId}>
                        <button
                          type="button"
                          onClick={() => setActiveFileIndex(i)}
                          className={`flex w-full items-center gap-x-2.5 px-4 py-3 text-sm text-start transition-colors ${
                            i === activeFileIndex
                              ? "bg-brand-blue/10 text-brand-blue"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <FileText
                            className="h-4 w-4 shrink-0"
                            aria-hidden
                          />
                          <span className="min-w-0 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {activeFile ? (
                    <DriveViewer fileId={activeFile.fileId} name={activeFile.name} />
                  ) : (
                    <div className="modern-card flex items-center justify-center p-10 text-slate-500 dark:text-slate-400">
                      <BookOpen className="me-2 h-5 w-5" aria-hidden />
                      <span>{t("selectSubject")}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="modern-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("examsHint")}
                </p>
                <Link
                  href="/quizzes"
                  className="inline-flex items-center gap-x-1.5 rounded-full bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  {t("examsCta")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
