import { BookOpen } from "lucide-react";
import { SUBJECT_ICONS } from "../constants/subjects";
import { useSubjects } from "../hooks/useSubjects";
import { useLocale, useTranslations } from "next-intl";

import { usePlatformSettings } from "../hooks/usePlatformSettings";

interface SubjectsGridProps {
  onSubjectClick?: (subjectName: string) => void;
  showOnlyOnHome?: boolean;
  is_academic?: boolean;
}

export function SubjectsGrid({
  onSubjectClick,
  showOnlyOnHome = false,
  is_academic = true,
}: SubjectsGridProps) {
  const locale = useLocale();
  const tSubjects = useTranslations("subjects");
  const { activeSemester } = usePlatformSettings();
  const { subjects, loading } = useSubjects({ is_academic });

  const filteredSubjects = subjects.filter((s) => {
    // 1. Home visibility check
    if (showOnlyOnHome && !s.show_on_home) return false;

    // 2. Semester filter (only for academic subjects)
    if (is_academic) {
      if (!s.semester) return true; // General subjects show in both semesters
      return Number(s.semester) === activeSemester;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="modern-card p-6 animate-pulse">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl mx-auto mb-4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredSubjects.map((subject) => {
          const IconComponent = SUBJECT_ICONS[subject.name] || BookOpen;

          const displayName =
            locale === "en" && subject.name_en ? subject.name_en : subject.name;

          return (
            <div
              key={subject.id}
              onClick={() => onSubjectClick?.(subject.name)}
              className="modern-card p-6 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
            >
              <div className="text-center">
                <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-brand-blue/20 group-hover:scale-110 transition-all duration-300">
                  <IconComponent className="w-7 h-7 text-brand-blue" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-2">
                  {displayName}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-12">
          {is_academic ? (
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          ) : (
            <img
              src="https://framerusercontent.com/images/lVFqGPfJm0f8Q6XqNcyZnWvQUe8.webp?width=256&height=256"
              alt="TRW Logo"
              className="w-24 h-24 object-contain mx-auto mb-4 grayscale opacity-50"
            />
          )}
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {is_academic
              ? tSubjects("emptyAcademicTitle")
              : tSubjects("emptyNonAcademicTitle")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {is_academic
              ? tSubjects("emptyAcademicDescription")
              : tSubjects("emptyNonAcademicDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
