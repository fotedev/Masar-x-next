import { BookOpen } from "lucide-react";
import { SUBJECT_ICONS } from "../constants/subjects";
import { useSubjects } from "../hooks/useSubjects";

interface SubjectsGridProps {
  onSubjectClick?: (subjectName: string) => void;
  showOnlyOnHome?: boolean;
}

export function SubjectsGrid({ onSubjectClick, showOnlyOnHome = false }: SubjectsGridProps) {
  const { subjects, loading } = useSubjects();

  const filteredSubjects = showOnlyOnHome 
    ? subjects.filter(s => s.show_on_home)
    : subjects;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="modern-card p-6 animate-pulse"
          >
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
                  {subject.name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد مواد
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            سيتم إضافة المواد الدراسية قريباً
          </p>
        </div>
      )}
    </div>
  );
}
