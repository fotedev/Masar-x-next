"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { scheduleSheets } from "@/lib/schedules";
import { ScheduleGrid } from "./_components/ScheduleGrid";

export default function SchedulesPage() {
  const t = useTranslations("schedules");

  const [activeId, setActiveId] = useState(scheduleSheets[0]?.id ?? "");
  const active = useMemo(
    () => scheduleSheets.find((s) => s.id === activeId) ?? scheduleSheets[0],
    [activeId],
  );

  return (
    <div className="space-y-6" data-testid="schedules-page">
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
                {sheet.tab ?? sheet.id}
              </button>
            ))}
          </div>

          {active.fetchedAt && (
            <p className="text-center text-xs text-slate-400">
              {t("fetchedAt", { date: new Date(active.fetchedAt).toLocaleDateString("ar-EG") })}
            </p>
          )}

          <ScheduleGrid sheet={active} />
        </>
      ) : (
        <p className="modern-card p-8 text-center text-slate-500 dark:text-slate-400">
          {t("selectTab")}
        </p>
      )}
    </div>
  );
}
