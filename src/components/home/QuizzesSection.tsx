"use client";

import { FileText, BookOpen, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { Quiz } from "@/types/database";

interface QuizzesSectionProps {
  loading: boolean;
  subjectsLoading: boolean;
  displayQuizzes: Quiz[];
  tHome: (key: string) => string;
  onNavigate: (page: string, id?: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export function QuizzesSection({
  loading,
  subjectsLoading,
  displayQuizzes,
  tHome,
  onNavigate,
}: QuizzesSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {tHome("exams")}
        </h2>
        <button
          onClick={() => onNavigate("quizzes")}
          className="text-brand-blue hover:text-brand-sky text-sm font-semibold transition-colors flex items-center gap-1"
        >
          {tHome("viewExams")}
          <span className="text-lg">←</span>
        </button>
      </div>

      {subjectsLoading || loading ? (
        <div className="summary-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="modern-card p-5 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-3"></div>
              <div className="space-y-3 mb-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : displayQuizzes.length === 0 ? (
        <div className="modern-card p-12 text-center">
          <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {tHome("goToExams")}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="summary-grid"
        >
          {displayQuizzes.map((quiz) => (
            <motion.div
              key={quiz.id}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="modern-card p-5 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
              onClick={() => onNavigate("quiz-play", quiz.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-brand-blue transition-colors">
                  {quiz.title}
                </h3>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
                    <span className="truncate">
                      {(() => {
                        try {
                          const parsed = JSON.parse(quiz.description || "{}");
                          return parsed.subject || quiz.subject || "عام";
                        } catch {
                          return quiz.subject || "عام";
                        }
                      })()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="truncate">
                    {(() => {
                      try {
                        const parsed = JSON.parse(quiz.description || "{}");
                        const quizRecord = quiz as unknown as Record<
                          string,
                          unknown
                        >;
                        const deptRaw =
                          typeof parsed?.department === "string"
                            ? parsed.department
                            : quizRecord.department;
                        const yearRaw =
                          typeof parsed?.year === "string"
                            ? parsed.year
                            : quizRecord.year;

                        const dept = typeof deptRaw === "string" ? deptRaw : "";
                        const year = typeof yearRaw === "string" ? yearRaw : "";
                        return (
                          `${year || ""}${dept ? ` - ${dept}` : ""}`.trim() ||
                          ""
                        );
                      } catch {
                        const quizRecord = quiz as unknown as Record<
                          string,
                          unknown
                        >;
                        const dept =
                          typeof quizRecord.department === "string"
                            ? quizRecord.department
                            : "";
                        const year =
                          typeof quizRecord.year === "string"
                            ? quizRecord.year
                            : "";
                        return (
                          `${year || ""}${dept ? ` - ${dept}` : ""}`.trim() ||
                          ""
                        );
                      }
                    })()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {(() => {
                    try {
                      const parsed = JSON.parse(quiz.description || "{}");
                      return parsed.description || "";
                    } catch {
                      return "";
                    }
                  })()}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
