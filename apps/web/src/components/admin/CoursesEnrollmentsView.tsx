"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CoursesTab } from "@/components/CoursesTab";
import { EnrollmentsTab } from "@/components/EnrollmentsTab";

export type CoursesTabCourse = Parameters<
  NonNullable<ComponentProps<typeof CoursesTab>["onEditCourse"]>
>[0];

/**
 * CoursesEnrollmentsView — the single "Courses & Enrollments" destination
 * (spec 006 IA). Doctor-gated upstream; both sections keep their legacy
 * components and switch via a segmented control instead of two nav items.
 */
export function CoursesEnrollmentsView({
  onCreateCourse,
  onEditCourse,
}: {
  onCreateCourse: () => void;
  onEditCourse: (course: CoursesTabCourse) => void;
}) {
  const t = useTranslations("adminDashboard");
  const [view, setView] = useState<"courses" | "enrollments">("courses");

  const views = [
    { id: "courses" as const, label: t("tabs.courses") },
    { id: "enrollments" as const, label: t("tabs.enrollments") },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t("tabs.coursesEnrollments")}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/60"
      >
        {views.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex h-11 min-w-[96px] items-center justify-center rounded-md px-4 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              view === v.id
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "courses" ? (
        <CoursesTab onCreateCourse={onCreateCourse} onEditCourse={onEditCourse} />
      ) : (
        <EnrollmentsTab />
      )}
    </div>
  );
}
