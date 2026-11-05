"use client";

import { useMemo } from "react";
import {
  flattenSubjectFiles,
  materialSubjects,
  sortSubjects,
  type DriveSubject,
} from "@/lib/materials";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveSemester } from "@/hooks/useEffectiveSemester";

export function useMaterialsData() {
  const subjects = useMemo(() => sortSubjects(materialSubjects), []);
  const { academic, loading: academicLoading } = useUserAcademic();
  const { isAdmin } = useAuth();
  // Spec 013 resolution: profile semester → guest localStorage → platform default.
  const { effectiveSemester } = useEffectiveSemester(academic.semester);

  // Owner decision 2026-11-05: level/semester selection lives in the profile,
  // not on this page. Admins browse the whole library (same rule as
  // useSubjects); signed-in students get their profile level+semester;
  // guests fall back to level 1 with the effective-semester resolution.
  const filteredSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (academicLoading) return [];
    const level = academic.level ?? 1;
    return subjects.filter(
      (s) => s.level === level && s.semester === effectiveSemester,
    );
  }, [subjects, isAdmin, academicLoading, academic.level, effectiveSemester]);

  const fileCount = (subject: DriveSubject) =>
    flattenSubjectFiles(subject).length;

  return { filteredSubjects, fileCount };
}
