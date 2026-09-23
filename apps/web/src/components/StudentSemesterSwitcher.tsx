"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useUserAcademic } from "../hooks/useUserAcademic";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import {
  readGuestSemester,
  writeGuestSemester,
} from "../hooks/useEffectiveSemester";

const TERM_KEYS = { 1: "term1", 2: "term2", 3: "term3" } as const;
const SEMESTERS = [1, 2, 3] as const;

/**
 * Spec 013 — student semester switcher (display only).
 * Signed-in users update their own profile semester (one statement, marked
 * manually-set so bulk migrations keep it); guests persist their choice in
 * localStorage. Nothing is gated — this only re-filters the catalog view.
 */
export function StudentSemesterSwitcher({ className = "" }: { className?: string }) {
  const tHeader = useTranslations("header.semester");
  const tOnboarding = useTranslations("onboarding.academic");
  const { user } = useAuth();
  const { academic, setUserSemester } = useUserAcademic();
  const { defaultSemester } = usePlatformSettings();
  const [guestSemester, setGuestSemester] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setGuestSemester(readGuestSemester());
  }, []);

  // null until mounted — avoids SSR/localStorage hydration mismatch.
  const current: number | null = mounted
    ? user
      ? (academic.semester ?? guestSemester ?? defaultSemester)
      : (guestSemester ?? defaultSemester)
    : null;

  const onSelect = async (semester: number) => {
    if (pending !== null || semester === current) return;

    if (!user) {
      writeGuestSemester(semester);
      setGuestSemester(semester);
      return;
    }

    setPending(semester);
    const result = await setUserSemester(semester);
    setPending(null);
    if (!result.success) {
      toast.error(tHeader("updateFailed"));
    }
  };

  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 opacity-0 ${className}`} aria-hidden="true">
        <CalendarDays className="w-4 h-4" />
        <span className="text-sm font-medium">{tHeader("label")}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="group"
      aria-label={tHeader("ariaLabel")}
    >
      <CalendarDays className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {tHeader("label")}:
      </span>
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shadow-inner">
        {SEMESTERS.map((semester, index) => (
          <button
            key={semester}
            type="button"
            onClick={() => onSelect(semester)}
            disabled={pending !== null}
            aria-pressed={current === semester}
            className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-bold transition-[background-color,color,transform] duration-200 disabled:opacity-60 ${
              index > 0 ? "ml-0.5" : ""
            } ${
              current === semester
                ? "bg-blue-600 text-white shadow-sm scale-105"
                : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {tOnboarding(TERM_KEYS[semester])}
              {pending === semester && (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
