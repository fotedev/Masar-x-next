"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/admin-shell/useFocusTrap";
import { useScrollLock } from "@/hooks/admin-shell/useScrollLock";
import type { AcademicLevelOption, DepartmentOption } from "@/hooks/useAcademicOptions";
import type { Subject } from "@/types/database";

export interface FilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
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

export function FilterBottomSheet({
  open,
  onClose,
  globalFilters,
  setGlobalFilters,
  levels,
  availableDepartments,
  subjects,
  onClearFilters,
}: FilterBottomSheetProps) {
  const t = useTranslations("adminDashboard");
  const [mounted, setMounted] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useFocusTrap(sheetRef, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const hasActiveFilters = Boolean(
    globalFilters.year || globalFilters.department || globalFilters.subject,
  );

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      onClose();
    }
  };

  const focusRing =
    "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

  if (!mounted || !everOpened) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "ax-drawer-backdrop fixed inset-0 z-[70] bg-black/40 lg:hidden",
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      />

      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("filterBar.sheetTitle")}
        aria-hidden={!open}
        tabIndex={-1}
        initial={false}
        animate={open ? { y: 0 } : { y: "100%" }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 28, stiffness: 300 }
        }
        drag={shouldReduceMotion ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[75] flex max-h-[85vh] flex-col rounded-t-2xl border-t border-ax-edge bg-ax-surface p-5 shadow-ax-lg outline-none lg:hidden",
          "pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
          open
            ? "visible pointer-events-auto"
            : "pointer-events-none invisible",
        )}
      >
        {/* Drag handle pill */}
        <div
          aria-hidden="true"
          className="mx-auto -mt-1 mb-3 h-1.5 w-12 shrink-0 rounded-full bg-ax-edge-strong/40"
        />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-ax-edge">
          <h2 className="text-base font-semibold text-ax-primary">
            {t("filterBar.sheetTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("shell.closeNavigation")}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
              focusRing,
            )}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {/* Form controls */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Level / Year select */}
          <div>
            <label
              htmlFor="sheet-filter-year"
              className="mb-1.5 block text-xs font-semibold text-ax-secondary"
            >
              {t("filterBar.level")}
            </label>
            <select
              id="sheet-filter-year"
              name="year"
              value={globalFilters.year}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  year: e.target.value,
                  department: "",
                }))
              }
              className={cn(
                "h-11 w-full rounded-lg border border-ax-edge bg-ax-surface px-3 text-sm text-ax-primary outline-none transition-colors focus:border-ax-accent",
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
          </div>

          {/* Department select */}
          <div>
            <label
              htmlFor="sheet-filter-department"
              className="mb-1.5 block text-xs font-semibold text-ax-secondary"
            >
              {t("filterBar.department")}
            </label>
            <select
              id="sheet-filter-department"
              name="department"
              value={globalFilters.department}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
              disabled={!globalFilters.year || availableDepartments.length === 0}
              className={cn(
                "h-11 w-full rounded-lg border border-ax-edge bg-ax-surface px-3 text-sm text-ax-primary outline-none transition-colors focus:border-ax-accent disabled:opacity-50",
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
          </div>

          {/* Subject select */}
          <div>
            <label
              htmlFor="sheet-filter-subject"
              className="mb-1.5 block text-xs font-semibold text-ax-secondary"
            >
              {t("filterBar.subject")}
            </label>
            <select
              id="sheet-filter-subject"
              name="subject"
              value={globalFilters.subject}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  subject: e.target.value,
                }))
              }
              className={cn(
                "h-11 w-full rounded-lg border border-ax-edge bg-ax-surface px-3 text-sm text-ax-primary outline-none transition-colors focus:border-ax-accent",
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
          </div>

          {/* Active filter pills */}
          {hasActiveFilters ? (
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-ax-muted">
                {t("filterBar.activeCount", {
                  count: [
                    globalFilters.year,
                    globalFilters.department,
                    globalFilters.subject,
                  ].filter(Boolean).length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {globalFilters.year ? (
                  <div className="flex items-center gap-1 rounded-full border border-ax-edge bg-ax-surface-inset ps-3 pe-1 text-xs font-medium text-ax-primary">
                    <span className="max-w-[20ch] truncate">
                      {globalFilters.year}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setGlobalFilters((prev) => ({
                          ...prev,
                          year: "",
                          department: "",
                        }))
                      }
                      aria-label={t("filterBar.clearPill", {
                        name: globalFilters.year,
                      })}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-ax-muted outline-none transition-colors hover:text-ax-danger",
                        focusRing,
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {globalFilters.department ? (
                  <div className="flex items-center gap-1 rounded-full border border-ax-edge bg-ax-surface-inset ps-3 pe-1 text-xs font-medium text-ax-primary">
                    <span className="max-w-[20ch] truncate">
                      {globalFilters.department}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setGlobalFilters((prev) => ({
                          ...prev,
                          department: "",
                        }))
                      }
                      aria-label={t("filterBar.clearPill", {
                        name: globalFilters.department,
                      })}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-ax-muted outline-none transition-colors hover:text-ax-danger",
                        focusRing,
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {globalFilters.subject ? (
                  <div className="flex items-center gap-1 rounded-full border border-ax-edge bg-ax-surface-inset ps-3 pe-1 text-xs font-medium text-ax-primary">
                    <span className="max-w-[20ch] truncate">
                      {globalFilters.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setGlobalFilters((prev) => ({
                          ...prev,
                          subject: "",
                        }))
                      }
                      aria-label={t("filterBar.clearPill", {
                        name: globalFilters.subject,
                      })}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-ax-muted outline-none transition-colors hover:text-ax-danger",
                        focusRing,
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-ax-edge pt-3">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border border-ax-edge bg-ax-surface-inset px-4 text-sm font-medium text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
                focusRing,
              )}
            >
              {t("filterBar.clearAll")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg bg-ax-accent px-5 text-sm font-semibold text-ax-on-accent outline-none transition-colors duration-150 hover:bg-ax-accent-hover",
              focusRing,
            )}
          >
            {t("filterBar.done")}
          </button>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
