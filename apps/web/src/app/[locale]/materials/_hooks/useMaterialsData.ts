"use client";

import { useMemo, useState } from "react";
import {
  flattenSubjectFiles,
  materialSubjects,
  sortSubjects,
  type DriveSubject,
} from "@/lib/materials";

export type TermFilter = "all" | `${number}-${number}`;

/** Distinct level-semester pairs present in the manifest, newest term first. */
export function listTerms(subjects: DriveSubject[]): `${number}-${number}`[] {
  const seen = new Set<string>();
  for (const s of subjects) seen.add(`${s.level}-${s.semester}`);
  return [...seen]
    .sort((a, b) => {
      const [la, sa] = a.split("-").map(Number);
      const [lb, sb] = b.split("-").map(Number);
      return lb - la || sb - sa;
    })
    .map((t) => t as `${number}-${number}`);
}

export function useMaterialsData() {
  const subjects = useMemo(() => sortSubjects(materialSubjects), []);
  const terms = useMemo(() => listTerms(subjects), [subjects]);

  const [term, setTerm] = useState<TermFilter>("all");

  const filteredSubjects = useMemo(
    () =>
      term === "all"
        ? subjects
        : subjects.filter((s) => `${s.level}-${s.semester}` === term),
    [subjects, term],
  );

  const fileCount = (subject: DriveSubject) =>
    flattenSubjectFiles(subject).length;

  return { subjects, terms, term, setTerm, filteredSubjects, fileCount };
}
