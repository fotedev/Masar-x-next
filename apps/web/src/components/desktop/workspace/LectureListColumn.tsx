"use client";

import { useTranslations } from "next-intl";
import type { WorkspaceLecture } from "./types";

/**
 * T011 — Fixed-width column listing lectures (and their summary
 * badges) for the current subject. Independent scroll, marks the
 * active lecture, and renders an empty state (FR-002 / FR-007 / FR-009).
 *
 * Layout note: width is fixed at the column wrapper level (StudyWorkspace
 * composes this column inside a `w-72 shrink-0` flex item). This file
 * owns the inner scroll only.
 */
interface LectureListColumnProps {
  lectures: WorkspaceLecture[];
  activeLectureId: string | null;
  onSelect: (lectureId: string) => void;
  subjectName: string;
}

export function LectureListColumn({
  lectures,
  activeLectureId,
  onSelect,
  subjectName,
}: LectureListColumnProps) {
  const t = useTranslations("desktopStudyWorkspace");

  if (lectures.length === 0) {
    return (
      <aside
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground"
        // Selection suppressed on chrome; study content overrides it (FR-013/014).
        // `select-none` here mirrors the T020 desktop-shell rule for column chrome.
        style={{ userSelect: "none" }}
        aria-label={t("sidebar.emptyAria", { subject: subjectName })}
      >
        <p className="text-base font-medium text-foreground">
          {t("sidebar.emptyTitle")}
        </p>
        <p className="max-w-[16rem] text-xs leading-relaxed">
          {t("sidebar.emptyBody", { subject: subjectName })}
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full w-full flex-col"
      // Independent scroll per FR-007: window never scrolls, only this pane.
      style={{ overflowY: "auto", scrollbarGutter: "stable" }}
      aria-label={t("sidebar.aria", { subject: subjectName })}
    >
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("sidebar.heading")}
        </p>
        <h2 className="truncate text-sm font-semibold text-foreground">
          {subjectName}
        </h2>
      </header>

      <ul role="listbox" aria-label={t("sidebar.listAria")} className="flex flex-col">
        {lectures.map((lecture) => {
          const isActive = lecture.id === activeLectureId;
          return (
            <li key={lecture.id}>
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(lecture.id)}
                className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm ${
                      isActive ? "font-semibold text-foreground" : "text-foreground"
                    }`}
                    // suppress selection on chrome (FR-013)
                    style={{ userSelect: "none" }}
                  >
                    {lecture.title}
                  </span>
                  {typeof lecture.ordinal === "number" && (
                    <span
                      className="shrink-0 text-xs tabular-nums text-muted-foreground"
                      style={{ userSelect: "none" }}
                    >
                      #{lecture.ordinal}
                    </span>
                  )}
                </div>

                {lecture.counts ? (
                  <div
                    className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"
                    style={{ userSelect: "none" }}
                  >
                    {lecture.counts.summaries > 0 && (
                      <span>{t("sidebar.counts.summaries", { count: lecture.counts.summaries })}</span>
                    )}
                    {lecture.counts.videos > 0 && (
                      <span>{t("sidebar.counts.videos", { count: lecture.counts.videos })}</span>
                    )}
                    {lecture.counts.files > 0 && (
                      <span>{t("sidebar.counts.files", { count: lecture.counts.files })}</span>
                    )}
                    {lecture.counts.quizzes > 0 && (
                      <span>{t("sidebar.counts.quizzes", { count: lecture.counts.quizzes })}</span>
                    )}
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
