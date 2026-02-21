"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useUserAcademic } from "@/hooks/useUserAcademic";

export function AcademicOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { academic, loading: academicLoading } = useUserAcademic();
  const hasRedirected = useRef(false);

  // Reset redirect guard when navigating away from onboarding
  useEffect(() => {
    if (!pathname?.startsWith("/onboarding")) {
      hasRedirected.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (authLoading || academicLoading) return;
    if (!user) return;
    if (isAdmin) return;
    if (pathname?.startsWith("/onboarding")) return;
    if (hasRedirected.current) return;

    // IMPORTANT: Wait for academic data to be fully loaded (not just from initial empty state)
    const hasAcademic = academic.level != null && academic.semester != null;

    if (!hasAcademic) {
      hasRedirected.current = true;
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
