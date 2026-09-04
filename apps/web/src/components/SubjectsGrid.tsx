import Image from "next/image";
import { BookOpen } from "lucide-react";
import { SUBJECT_ICONS } from "../constants/subjects";
import { useSubjects } from "../hooks/useSubjects";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "./ui/Skeleton";

import { usePlatformSettings } from "../hooks/usePlatformSettings";

import { motion, useReducedMotion } from "framer-motion";

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
  const shouldReduceMotion = useReducedMotion();
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="modern-card p-6 w-full min-h-[160px] flex flex-col items-center justify-center">
            <div className="text-center flex flex-col items-center justify-center h-full w-full">
              <Skeleton className="w-14 h-14 rounded-2xl mb-4" />
              <Skeleton className="h-5 rounded-lg w-3/4 mt-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial="hidden"
        animate="show"
        variants={
          shouldReduceMotion
            ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
            : {
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05,
                    delayChildren: 0.1,
                  },
                },
              }
        }
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {filteredSubjects.map((subject) => {
          const IconComponent = SUBJECT_ICONS[subject.name] || BookOpen;

          const displayName =
            locale === "en" && subject.name_en ? subject.name_en : subject.name;

          return (
            <motion.button
              key={subject.id}
              variants={
                shouldReduceMotion
                  ? { hidden: {}, show: {} }
                  : { hidden: { opacity: 0 }, show: { opacity: 1 } }
              }
              whileHover={
                !shouldReduceMotion && !subject.isOptimistic
                  ? { scale: 1.05, translateY: -4 }
                  : {}
              }
              whileTap={!subject.isOptimistic ? { scale: 0.95 } : {}}
              onClick={() => !subject.isOptimistic && onSubjectClick?.(subject.name)}
              className={`modern-card p-6 transition-[colors,transform,box-shadow,border-color,outline-color] duration-300 w-full flex flex-col items-center justify-center min-h-[160px] outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 focus-visible:border-brand-blue/60
                ${subject.isOptimistic
                  ? "opacity-60 cursor-not-allowed border-dashed border-brand-blue/30 animate-pulse"
                  : "cursor-pointer group hover:border-brand-blue/50"
                }`}
              type="button"
            >
              <div className="text-center flex flex-col items-center justify-center h-full w-full">
                <div className={`w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-[colors,transform] duration-300 flex-shrink-0
                  ${!subject.isOptimistic ? "group-hover:bg-brand-blue/20 group-hover:scale-110" : ""}`}>
                  <IconComponent className="w-7 h-7 text-brand-blue" />
                </div>
                <h3 className={`text-sm sm:text-base font-bold transition-colors line-clamp-2 text-center mt-auto
                  ${subject.isOptimistic ? "text-slate-400" : "text-slate-900 dark:text-white group-hover:text-brand-blue"}`}>
                  {displayName}
                  {subject.isOptimistic && (
                    <span className="block text-[10px] mt-1 font-medium animate-pulse">
                      جاري الحفظ...
                    </span>
                  )}
                </h3>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-16 flex flex-col items-center">
          {is_academic ? (
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
              <BookOpen className="w-10 h-10 text-slate-400" />
            </div>
          ) : (
            <div className="relative w-24 h-24 mb-6 grayscale opacity-50">
              <Image
                src="https://framerusercontent.com/images/lVFqGPfJm0f8Q6XqNcyZnWvQUe8.webp?width=256&height=256"
                alt="TRW Logo"
                fill
                sizes="96px"
                className="object-contain"
              />
            </div>
          )}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {is_academic
              ? tSubjects("emptyAcademicTitle")
              : tSubjects("emptyNonAcademicTitle")}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
            {is_academic
              ? tSubjects("emptyAcademicDescription")
              : tSubjects("emptyNonAcademicDescription")}
          </p>
          {is_academic && (
            <button
              onClick={() => (window.location.href = `/${locale}/ai-assistant`)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300"
            >
              ابدأ المذاكرة مع زين AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}
