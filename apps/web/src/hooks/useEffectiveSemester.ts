"use client";

import { useEffect, useState } from "react";
import { usePlatformSettings } from "./usePlatformSettings";

/**
 * Spec 013 — effective-semester resolution (display filtering only).
 *
 * Signed-in students see subjects for THEIR profile semester; guests keep
 * their own choice in localStorage; everyone falls back to the admin-set
 * platform default. Nothing here is a security gate — it only decides which
 * slice of the subject catalog is displayed.
 */

export const GUEST_SEMESTER_STORAGE_KEY = "masar_guest_semester";
export const GUEST_SEMESTER_EVENT = "masarGuestSemesterChanged";

const VALID_SEMESTERS = new Set([1, 2, 3]);

export function readGuestSemester(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_SEMESTER_STORAGE_KEY);
    const n = raw === null ? NaN : Number(raw);
    return VALID_SEMESTERS.has(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeGuestSemester(semester: number): void {
  if (typeof window === "undefined" || !VALID_SEMESTERS.has(semester)) return;
  try {
    localStorage.setItem(GUEST_SEMESTER_STORAGE_KEY, String(semester));
  } catch {
    // storage unavailable (private mode etc.) — the in-memory event still applies
  }
  window.dispatchEvent(
    new CustomEvent(GUEST_SEMESTER_EVENT, { detail: semester }),
  );
}

/**
 * Resolves the semester whose subjects should be displayed:
 * profile semester → guest localStorage choice → platform default.
 * Always returns a valid 1..3 number, so query builders never interpolate
 * undefined/null into PostgREST syntax.
 */
export function useEffectiveSemester(
  profileSemester?: number | null,
): { effectiveSemester: number; guestSemester: number | null } {
  const { defaultSemester } = usePlatformSettings();
  const [guestSemester, setGuestSemester] = useState<number | null>(null);

  useEffect(() => {
    setGuestSemester(readGuestSemester());

    const onGuestChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      setGuestSemester(VALID_SEMESTERS.has(detail) ? detail : null);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GUEST_SEMESTER_STORAGE_KEY) setGuestSemester(readGuestSemester());
    };

    window.addEventListener(GUEST_SEMESTER_EVENT, onGuestChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(GUEST_SEMESTER_EVENT, onGuestChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const profile =
    typeof profileSemester === "number" && VALID_SEMESTERS.has(profileSemester)
      ? profileSemester
      : null;

  return {
    effectiveSemester: profile ?? guestSemester ?? defaultSemester,
    guestSemester,
  };
}
