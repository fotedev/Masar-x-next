"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { SubjectsGrid } from "@/components/SubjectsGrid";
import { useSubjects } from "@/hooks/useSubjects";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { LevelTabs } from "./_components/LevelTabs";

function SubjectsPage() {
  const router = useRouter();
  const tSubjects = useTranslations("subjects");
  const { academic } = useUserAcademic();
  // Spec 034: the catalog fetches every level once; the tab bar filters
  // client-side. Default selection = the viewer's own academic level.
  const { subjects, loading } = useSubjects({ allLevels: true });
  const { levels } = useAcademicOptions();

  const [activeLevel, setActiveLevel] = useState<number>(academic.level ?? 1);

  const sortedLevels = useMemo(
    () =>
      [...levels].sort(
        (a, b) => (a.level_number ?? 99) - (b.level_number ?? 99),
      ),
    [levels],
  );

  const visibleSubjects = useMemo(
    () =>
      subjects.filter(
        (s) =>
          s.level === activeLevel ||
          // Legacy rows without a level stay visible on every tab
          // (same back-compat rule as the scoped query's level.is.null).
          s.level === null ||
          s.level === undefined,
      ),
    [subjects, activeLevel],
  );

  const handleSubjectClick = (subjectName: string) => {
    // Navigate to subject page with encoded subject name
    router.push(`/subjects/${encodeURIComponent(subjectName)}`);
  };

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          {tSubjects("title")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {tSubjects("description")}
        </p>
      </div>

      <LevelTabs
        levels={sortedLevels}
        active={activeLevel}
        onSelect={setActiveLevel}
      />

      <div className="modern-card p-6 sm:p-8">
        <SubjectsGrid
          onSubjectClick={handleSubjectClick}
          subjects={loading ? undefined : visibleSubjects}
        />
      </div>
    </div>
  );
}

export default SubjectsPage;
