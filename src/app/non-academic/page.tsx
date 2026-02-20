"use client";

import { useRouter } from "next/navigation";
import { SubjectsGrid } from "../../components/SubjectsGrid";
import { BookOpen } from "lucide-react";

export default function NonAcademicPage() {
  const router = useRouter();

  const handleSubjectClick = (subjectName: string) => {
    // Navigate to subject page within non-academic section
    router.push(`/non-academic/${encodeURIComponent(subjectName)}`);
  };

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-3 bg-brand-blue/10 rounded-2xl mb-4">
          <BookOpen className="w-8 h-8 text-brand-blue" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          TRW
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Welcome to the Real World
        </p>
      </div>

      <div className="modern-card p-6 sm:p-8">
        <SubjectsGrid onSubjectClick={handleSubjectClick} is_academic={false} />
      </div>
    </div>
  );
}
