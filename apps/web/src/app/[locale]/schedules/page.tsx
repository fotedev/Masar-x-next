"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { scheduleSheets } from "@/lib/schedules";
import { ScheduleGrid } from "./_components/ScheduleGrid";
import { SectionTimetable } from "./_components/SectionTimetable";

type ViewMode = "timetable" | "raw";

/**
 * Schedules page — spec 034 surface, enhanced by spec 047: the section
 * matrix is the default view; the faithful raw grid (spec 034 e2e contract)
 * stays reachable through the view toggle. Cohort tabs are localized by
 * sheet id (raw data labels are Arabic-only) and fetchedAt is formatted
 * with the active locale.
 */
export default function SchedulesPage() {
  const t = useTranslations("schedules");
  const locale = useLocale();

  const [activeId, setActiveId] = useState(scheduleSheets[0]?.id ?? "");
  const [view, setView] = useState<ViewMode>("timetable");
  const active = useMemo(
    () => scheduleSheets.find((s) => s.id === activeId) ?? scheduleSheets[0],
    [activeId],
  );

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
        dateStyle: "medium",
      }),
    [locale],
  );

  const toggleButton = (mode: ViewMode, label: string) => (
    <button
      type="button"
      data-testid={`schedules-view-${mode}`}
      aria-pressed={view === mode}
      onClick={() => setView(mode)}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        view === mode
          ? "bg-brand-blue text-white"
          : "text-slate-600 dark:text-slate-300 hover:text-brand-blue"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="flex flex-col gap-6 min-h-0 overflow-y-auto pb-6"
      data-testid="schedules-page"
    >
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          {t("title")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {t("description")}
        </p>
      </div>

      {scheduleSheets.length > 0 && active ? (
        <>
          <div className="flex flex-wrap justify-center gap-2" data-testid="schedules-tabs">
            {scheduleSheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => setActiveId(sheet.id)}
                aria-pressed={sheet.id === active.id}
                data-testid="schedules-tab"
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  sheet.id === active.id
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue"
                }`}
              >
                {t(sheet.id)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <div
              className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
              data-testid="schedules-view-toggle"
            >
              {toggleButton("timetable", t("viewTimetable"))}
              {toggleButton("raw", t("viewRaw"))}
            </div>

            {active.fetchedAt && (
              <p className="text-xs text-slate-400">
                {t("fetchedAt", { date: dateFmt.format(new Date(active.fetchedAt)) })}
              </p>
            )}
          </div>

          {view === "timetable" ? (
            <SectionTimetable key={active.id} sheet={active} />
          ) : (
            <ScheduleGrid sheet={active} />
          )}
        </>
      ) : (
        <p className="modern-card p-8 text-center text-slate-500 dark:text-slate-400">
          {t("selectTab")}
        </p>
      )}
    </div>
  );
}
