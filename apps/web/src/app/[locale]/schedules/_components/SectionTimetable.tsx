"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScheduleSheet, WeekdayKey } from "@/lib/schedules";
import {
  cellParts,
  detectBlocks,
  headerRowIndex,
  splitDays,
  subjectColorIndex,
  timeSlotHour,
  todayDayName,
  weekdayKeyOf,
} from "@/lib/schedules";

/**
 * Spec 047 — section-matrix timetable (default view).
 *
 * Renders one department block at a time: block chips → day chips → a
 * time × sections matrix. Cells keep their exact source text (spec 034
 * fidelity doctrine) but gain presentation split (primary/secondary lines)
 * and a stable per-subject color chip. Today is auto-selected and the
 * current hourly slot is ring-highlighted. The original raw grid remains
 * available through the page's "Raw grid" toggle (spec 034 e2e contract).
 */

/** Subject chip palette — explicit class strings (Tailwind JIT-safe). */
const CHIP_CLASSES = [
  "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60",
  "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60",
  "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/60",
  "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60",
  "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/60",
  "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/60",
  "bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-800/60",
  "bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800/60",
] as const;

const DAY_MSG_KEYS: Record<WeekdayKey, string> = {
  saturday: "daySaturday",
  sunday: "daySunday",
  monday: "dayMonday",
  tuesday: "dayTuesday",
  wednesday: "dayWednesday",
  thursday: "dayThursday",
  friday: "dayFriday",
};

const BLOCK_PILL =
  "rounded-full px-4 py-1.5 text-sm font-medium border transition-colors";
const BLOCK_PILL_ACTIVE = "bg-brand-blue text-white border-brand-blue";
const BLOCK_PILL_IDLE =
  "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue";

export function SectionTimetable({ sheet }: { sheet: ScheduleSheet }) {
  const t = useTranslations("schedules");

  const blocks = useMemo(() => detectBlocks(sheet), [sheet]);
  const [blockIdx, setBlockIdx] = useState(0);
  const block = blocks[Math.min(blockIdx, Math.max(blocks.length - 1, 0))];
  const days = useMemo(
    () => (block ? splitDays(sheet, block) : []),
    [sheet, block],
  );

  // Today + current hour are client-only state (hydration-safe: the server
  // and the first paint render the neutral defaults, then this settles).
  const [todayKey, setTodayKey] = useState<WeekdayKey | null>(null);
  const [nowHour, setNowHour] = useState<number | null>(null);
  useEffect(() => {
    setTodayKey(weekdayKeyOf(todayDayName()));
    setNowHour(new Date().getHours());
  }, []);

  const [dayIdx, setDayIdx] = useState(0);
  // Jump to today once known (kept when switching blocks/days).
  useEffect(() => {
    if (!todayKey) return;
    const idx = days.findIndex((d) => weekdayKeyOf(d.day) === todayKey);
    if (idx >= 0) setDayIdx(idx);
  }, [days, todayKey]);

  if (!block || days.length === 0) return null;

  const day = days[Math.min(dayIdx, days.length - 1)];
  const dayKey = weekdayKeyOf(day.day);
  const dayLabel = dayKey ? t(DAY_MSG_KEYS[dayKey]) : day.day;
  const isToday = todayKey !== null && dayKey === todayKey;
  const blockLabel = block.label ?? t("blockN", { n: blocks.indexOf(block) + 1 });
  const sectionRow = sheet.rows[headerRowIndex(sheet) + 1] ?? [];

  const rows = day.rowIndexes.map((r) => {
    const timeCell = sheet.rows[r][block.timeCol] ?? "";
    return {
      time: timeCell.trim(),
      hour: timeSlotHour(timeCell),
      cells: block.sectionCols.map((c) => sheet.rows[r][c] ?? ""),
    };
  });
  const hasClasses = rows.some((row) => row.cells.some((c) => c.trim() !== ""));

  return (
    <div className="space-y-3" data-testid="schedules-timetable">
      {/* Department-block chips */}
      <div className="flex flex-wrap justify-center gap-2" data-testid="schedules-blocks">
        {blocks.map((b, i) => (
          <button
            key={b.timeCol}
            type="button"
            data-testid="schedules-block"
            aria-pressed={i === blockIdx}
            onClick={() => setBlockIdx(i)}
            className={`${BLOCK_PILL} max-w-xs truncate ${i === blockIdx ? BLOCK_PILL_ACTIVE : BLOCK_PILL_IDLE}`}
            title={b.label ?? undefined}
          >
            {b.label ?? t("blockN", { n: i + 1 })}
          </button>
        ))}
      </div>

      {/* Day chips — today carries a dot marker */}
      <div className="flex flex-wrap justify-center gap-1.5" data-testid="schedules-days">
        {days.map((d, i) => {
          const key = weekdayKeyOf(d.day);
          const label = key ? t(DAY_MSG_KEYS[key]) : d.day;
          const active = i === Math.min(dayIdx, days.length - 1);
          return (
            <button
              key={`${d.day}-${i}`}
              type="button"
              data-testid="schedules-day"
              aria-pressed={active}
              onClick={() => setDayIdx(i)}
              className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                active
                  ? "bg-brand-blue text-white border-brand-blue"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue"
              }`}
            >
              {todayKey !== null && key === todayKey && (
                <span
                  className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white dark:ring-brand-navy"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">{todayKey !== null && key === todayKey ? `${t("todayChip")} — ` : ""}</span>
              {label}
            </button>
          );
        })}
      </div>

      {hasClasses ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium" title={blockLabel}>
              {dayLabel} · {blockLabel}
            </span>
            {" · "}
            {t("sourceNote")}
          </p>
          <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 dark:border-slate-700">
            <table
              className="w-full table-fixed border-collapse text-sm"
              // Fixed layout keeps the section columns uniform; the min-width
              // preserves horizontal scrolling on narrow screens.
              style={{ minWidth: 72 + block.sectionCols.length * 150 }}
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 z-30 start-0 w-[72px] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-start text-xs font-bold text-slate-500 dark:text-slate-300 whitespace-nowrap"
                  >
                    {t("timeHeading")}
                  </th>
                  {block.sectionCols.map((col, i) => (
                    <th
                      key={col}
                      scope="col"
                      className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-s border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-200"
                    >
                      {sectionRow[col]?.trim() || i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const isCurrentSlot =
                    isToday && nowHour !== null && row.hour !== null && nowHour === row.hour;
                  return (
                    <tr key={ri}>
                      <th
                        scope="row"
                        className={`sticky start-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-e border-slate-200 dark:border-slate-800 px-3 py-2 text-start text-xs font-semibold whitespace-nowrap ${
                          isCurrentSlot
                            ? "text-brand-blue dark:text-sky-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {row.time}
                      </th>
                      {row.cells.map((cell, ci) => {
                        const parts = cellParts(cell);
                        if (!parts.primary) {
                          return (
                            <td
                              key={ci}
                              className="border-b border-e border-slate-200 dark:border-slate-800 px-2 py-1.5 align-top"
                            />
                          );
                        }
                        const chip = CHIP_CLASSES[subjectColorIndex(parts.primary)];
                        return (
                          <td
                            key={ci}
                            className={`border-b border-e border-slate-200 dark:border-slate-800 px-2 py-1.5 align-top ${
                              isCurrentSlot ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                            }`}
                          >
                            <div className={`rounded-lg border px-2.5 py-1.5 ${chip}`}>
                              <p className="break-words text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                                {parts.primary}
                              </p>
                              {parts.secondary.map((line, li) => (
                                <p
                                  key={li}
                                  className="mt-0.5 break-words text-xs leading-snug text-slate-500 dark:text-slate-400"
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="modern-card p-8 text-center text-slate-500 dark:text-slate-400">
          {t("freeDay")}
        </p>
      )}
    </div>
  );
}
