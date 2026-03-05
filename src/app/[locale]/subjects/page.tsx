"use client";

import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { SubjectsGrid } from "@/components/SubjectsGrid";

function SubjectsPage() {
  const router = useRouter();
  const tSubjects = useTranslations("subjects");

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
        <SubjectsGrid onSubjectClick={handleSubjectClick} />
      </div>
    </div>
  );
}

export default SubjectsPage;
