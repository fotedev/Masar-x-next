"use client";

import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { SubjectsGrid } from "@/components/SubjectsGrid";
import { useSubjects } from "@/hooks/useSubjects";

function SubjectsPage() {
  const router = useRouter();
  const tSubjects = useTranslations("subjects");
  // Owner decision 2026-11-05: level selection lives in the profile, not on
  // this page (the spec 034 tab bar is gone). The default hook scopes the
  // query server-side to the viewer's profile level/semester; admins see
  // everything and guests fall back to level 1 + effective semester.
  const { subjects, loading } = useSubjects();

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

      <div className="modern-card p-6 sm:p-8">
        <SubjectsGrid
          onSubjectClick={handleSubjectClick}
          subjects={loading ? undefined : subjects}
        />
      </div>
    </div>
  );
}

export default SubjectsPage;
