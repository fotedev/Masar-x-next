"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ScheduleSheet } from "@/lib/schedules";

/**
 * Spec 034 — faithful raw-grid rendering of an extracted timetable sheet
 * (port of the proven sandbox links.html .sched-table: sticky header,
 * horizontal scroll, zebra rows). Cells are rendered as-is (multi-line
 * subject/staff/room) — 100% fidelity to the source grid.
 */
export function ScheduleGrid({ sheet }: { sheet: ScheduleSheet }) {
  const t = useTranslations("schedules");
  const [head, ...body] = useMemo(() => sheet.rows, [sheet.rows]);

  return (
    <div className="space-y-2" data-testid="schedules-grid">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sheet.tab ? `${sheet.tab} · ` : ""}
        {t("sourceNote")}
      </p>
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-start font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className={r % 2 === 1 ? "bg-slate-50 dark:bg-slate-900/40" : ""}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 align-top text-slate-700 dark:text-slate-300 whitespace-pre-line min-w-24"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
