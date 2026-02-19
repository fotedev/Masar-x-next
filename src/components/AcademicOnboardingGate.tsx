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

    const missing = academic.level == null || academic.semester == null;
    if (missing) {
      router.push("/onboarding/academic");
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
