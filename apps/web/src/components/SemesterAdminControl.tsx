"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { logger } from "@/lib/logger";
import { queryCache, cacheKeys } from "../lib/queryCache";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

const TERM_KEYS = { 1: "term1", 2: "term2", 3: "term3" } as const;
const SEMESTERS = [1, 2, 3] as const;

/**
 * Spec 013 — admin semester control: sets the platform default semester and
 * bulk-migrates existing students in one atomic RPC call. The RPC skips
 * students who set their semester manually (unless "include manually-set" is
 * enabled) and never touches admin accounts.
 */
export function SemesterAdminControl() {
  const t = useTranslations("adminDashboard.pageManagementTab");
  const tOnboarding = useTranslations("onboarding.academic");
  const { defaultSemester, loading } = usePlatformSettings();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [includeManual, setIncludeManual] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const value = selected ?? (mounted ? defaultSemester : 1);
  const semesterName = (s: number) => tOnboarding(TERM_KEYS[s as 1 | 2 | 3]);

  const apply = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc("admin_migrate_student_semesters", {
        p_target_semester: value,
        p_overwrite_manual: includeManual,
      });
      if (error) throw error;
      const count = typeof data === "number" ? data : 0;

      // The RPC already upserted default_semester server-side; realtime will
      // propagate it. Local optimistic update makes the admin's own UI instant.
      try {
        localStorage.setItem("defaultSemester", String(value));
        queryCache.delete(cacheKeys.settings());
        window.dispatchEvent(
          new CustomEvent("defaultSemesterChanged", { detail: value }),
        );
      } catch {
        // storage unavailable — realtime still covers it
      }

      toast.success(t("migratedToast", { count, semester: semesterName(value) }));
      setConfirming(false);
      setIncludeManual(false);
    } catch (e) {
      logger.error("admin_migrate_student_semesters failed", e);
      toast.error(t("migrateFailed"));
    } finally {
      setApplying(false);
    }
  };

  if (!mounted) {
    return <div className="h-10 opacity-0" aria-hidden="true" />;
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {t("defaultSemesterLabel")}:
        </span>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 shadow-inner">
          {SEMESTERS.map((semester, index) => (
            <button
              key={semester}
              type="button"
              onClick={() => {
                setSelected(semester);
                setConfirming(false);
              }}
              disabled={loading || applying}
              aria-pressed={value === semester}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-[background-color,color,transform] duration-200 disabled:opacity-60 ${
                index > 0 ? "ml-0.5" : ""
              } ${
                value === semester
                  ? "bg-blue-600 text-white shadow-sm scale-105"
                  : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {semesterName(semester)}
            </button>
          ))}
        </div>
      </div>

      {confirming ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm space-y-2 sm:max-w-md">
          <p className="font-bold text-amber-800 dark:text-amber-200">
            {t("applyConfirmTitle", { semester: semesterName(value) })}
          </p>
          <p className="text-amber-700 dark:text-amber-300/90 leading-relaxed">
            {t("applyConfirmDesc")}
          </p>
          <label className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
            <input
              type="checkbox"
              checked={includeManual}
              onChange={(e) => setIncludeManual(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            {t("includeManual")}
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={apply}
              disabled={applying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-[background-color] disabled:opacity-60"
            >
              {applying && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {applying ? t("applying") : t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setIncludeManual(false);
              }}
              disabled={applying}
              className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] disabled:opacity-60"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={applying}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-[background-color] disabled:opacity-60"
        >
          <Users className="w-4 h-4" aria-hidden="true" />
          {t("applyToStudents")}
        </button>
      )}
    </div>
  );
}
