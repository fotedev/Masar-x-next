"use client";

import { useState, type Dispatch, type SetStateAction, type FC } from "react";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AcademicLevelOption, DepartmentOption } from "@/hooks/useAcademicOptions";
import type { Subject } from "@/types/database";
import { FilterBottomSheet } from "./FilterBottomSheet";

export interface AdminDashboardHeaderProps {
  globalFilters: {
    subject: string;
    department: string;
    year: string;
  };
  setGlobalFilters: Dispatch<
    SetStateAction<{
      subject: string;
      department: string;
      year: string;
    }>
  >;
  levels: AcademicLevelOption[];
  availableDepartments: DepartmentOption[];
  subjects: Subject[];
  onClearFilters: () => void;
}

export const AdminDashboardHeader: FC<AdminDashboardHeaderProps> = ({
  globalFilters,
  setGlobalFilters,
  levels,
  availableDepartments,
  subjects,
  onClearFilters,
}) => {
  const t = useTranslations("adminDashboard");
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = [
    globalFilters.year,
    globalFilters.department,
    globalFilters.subject,
  ].filter(Boolean).length;

  const hasActiveFilters = activeCount > 0;

  const focusRing =
    "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

  return (
    <>
      <div className="rounded-xl border border-ax-edge bg-ax-surface p-4 shadow-ax-sm transition-colors sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-ax-primary sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-0.5 text-xs text-ax-muted sm:text-sm">
              {t("subtitle")}
            </p>
          </div>

          {/* Mobile/Tablet (<lg): ONE Filter trigger button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={t("filterBar.openFilters")}
              className={cn(
                "flex h-11 w-full items-center justify-between gap-2.5 rounded-lg border border-ax-edge bg-ax-surface-inset px-4 text-sm font-medium text-ax-primary outline-none transition-colors duration-150 hover:bg-ax-surface-hover",
                focusRing,
              )}
            >
              <div className="flex items-center gap-2">
                <Filter aria-hidden="true" className="h-4 w-4 text-ax-secondary" />
                <span>{t("filterBar.openFilters")}</span>
              </div>
              {hasActiveFilters ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ax-accent px-1.5 text-xs font-semibold text-ax-on-accent">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Desktop (>=lg): Compact single-row filter selects */}
          <div className="hidden lg:flex lg:items-center lg:gap-2.5">
            <div className="me-1 flex items-center gap-1.5 text-xs font-semibold text-ax-secondary">
              <Filter aria-hidden="true" className="h-4 w-4 text-ax-muted" />
              <span>{t("globalFilter")}</span>
            </div>

            <select
              id="admin-filter-year"
              name="year"
              value={globalFilters.year}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  year: e.target.value,
                  department: "",
                }))
              }
              aria-label={t("filterBar.level")}
              className={cn(
                "h-11 rounded-lg border border-ax-edge bg-ax-surface px-3 text-xs text-ax-primary outline-none transition-colors hover:border-ax-edge-strong focus:border-ax-accent",
                focusRing,
              )}
            >
              <option value="">{t("allLevels")}</option>
              {levels.map((level) => (
                <option key={level.id} value={level.name}>
                  {level.name}
                </option>
              ))}
            </select>

            <select
              id="admin-filter-department"
              name="department"
              value={globalFilters.department}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
              disabled={!globalFilters.year || availableDepartments.length === 0}
              aria-label={t("filterBar.department")}
              className={cn(
                "h-11 rounded-lg border border-ax-edge bg-ax-surface px-3 text-xs text-ax-primary outline-none transition-colors hover:border-ax-edge-strong focus:border-ax-accent disabled:opacity-50",
                focusRing,
              )}
            >
              <option value="">{t("allDepartments")}</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              id="admin-filter-subject"
              name="subject"
              value={globalFilters.subject}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  subject: e.target.value,
                }))
              }
              aria-label={t("filterBar.subject")}
              className={cn(
                "h-11 rounded-lg border border-ax-edge bg-ax-surface px-3 text-xs text-ax-primary outline-none transition-colors hover:border-ax-edge-strong focus:border-ax-accent",
                focusRing,
              )}
            >
              <option value="">{t("allSubjects")}</option>
              {[...new Set(subjects.map((s) => s.name))].sort().map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                aria-label={t("clearFilters")}
                title={t("clearFilters")}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ax-muted outline-none transition-colors duration-150 hover:bg-ax-danger-soft hover:text-ax-danger",
                  focusRing,
                )}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <FilterBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        globalFilters={globalFilters}
        setGlobalFilters={setGlobalFilters}
        levels={levels}
        availableDepartments={availableDepartments}
        subjects={subjects}
        onClearFilters={onClearFilters}
      />
    </>
  );
};
