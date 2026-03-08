"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "../contexts/AuthContext";
import { useUserAcademic } from "@/hooks/useUserAcademic";

export function AcademicOnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
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
    if (authLoading || academicLoading) {
      return;
    }

    if (!user) {
      return;
    }

    // Admins bypass onboarding
    if (isAdmin) {
      return;
    }

    if (pathname?.startsWith("/onboarding")) return;
    if (hasRedirected.current) return;

    // Check if academic data is actually missing
    const hasAcademic = academic.level !== null && academic.semester !== null;

    if (!hasAcademic) {
      // Add a 1-second grace period for state to settle
      const timer = setTimeout(() => {
        if (
          !hasRedirected.current &&
          pathname &&
          !pathname.startsWith("/onboarding")
        ) {
          // Final check: if still no academic data AND still not admin, redirect
          if (
            !isAdmin &&
            academic.level === null &&
            academic.semester === null
          ) {
            console.log(
              "[AcademicOnboardingGate] Redirecting after 1s grace period",
              {
                level: academic.level,
                semester: academic.semester,
                isAdmin,
              },
            );
            hasRedirected.current = true;
            router.replace(`/${locale}/onboarding/academic`);
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
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
