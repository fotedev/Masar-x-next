"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useUserAcademic } from "@/hooks/useUserAcademic";

export function AcademicOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { academic, loading: academicLoading } = useUserAcademic();

  useEffect(() => {
    if (authLoading || academicLoading) return;
    if (!user) return;
    if (isAdmin) return;

    if (pathname?.startsWith("/onboarding")) return;

    // IMPORTANT: Wait for academic data to be fully loaded (not just from initial empty state)
    // If loading is false, it means we either have data from cache or from a fresh fetch.
    const hasAcademic = academic.level != null && academic.semester != null;

    if (!hasAcademic) {
      router.replace("/onboarding/academic");
    }
  }, [
    academic.level,
    academic.semester,
    academicLoading,
    authLoading,
    isAdmin,
    pathname,
    router,
    user,
  ]);

  return null;
}
