"use client";

import { FileText, BookOpen, Calendar, Star } from "lucide-react";
import { motion } from "framer-motion";
import { SummaryWithRatings } from "@/types/database";
import { useLocale } from "next-intl";

interface SummariesSectionProps {
  loading: boolean;
  subjectsLoading: boolean;
  displaySummaries: SummaryWithRatings[];
  tHome: (key: string) => string;
  onNavigate: (page: string, id?: string) => void;
  trackSummaryClick: (id: string, action: string) => void;
  user: { id: string } | null;
  isAdmin: boolean;
  onEditSummary: (summary: SummaryWithRatings) => void;
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

export function SummariesSection({
  loading,
  subjectsLoading,
  displaySummaries,
  tHome,
  onNavigate,
  trackSummaryClick,
  user,
  isAdmin,
  onEditSummary,
}: SummariesSectionProps) {
  const locale = useLocale();
  return (
    <div className="space-y-6" dir="auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {tHome("best")}
        </h2>
        <button
          onClick={() => onNavigate("subjects")}
          className="text-brand-blue hover:text-brand-sky text-sm font-semibold transition-colors flex items-center gap-1"
        >
          {tHome("goToSubjects")}
          <span className={`text-lg transition-transform ${locale === 'ar' ? 'rotate-180' : ''}`}>←</span>
        </button>
      </div>
      {loading || subjectsLoading ? (
        <div className="summary-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="modern-card p-5 animate-pulse">
              <div className="flex justify-between items-start mb-3">
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
              </div>
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
      ) : displaySummaries.length === 0 ? (
        <div className="modern-card p-12 text-center">
          <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {tHome("goToSubjectsDescription")}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="summary-grid"
        >
          {displaySummaries.map((summary: SummaryWithRatings) => {
            const canEdit = user && (isAdmin || summary.user_id === user.id);

            return (
              <motion.div
                key={summary.id}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className="modern-card p-5 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
                onClick={() => {
                  trackSummaryClick(summary.id, "trending_click");
                  onNavigate("summaries", summary.id);
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-brand-blue transition-colors">
                    {summary.title}
                  </h3>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSummary(summary);
                      }}
                      className="text-slate-400 hover:text-brand-blue p-1.5 rounded-lg hover:bg-brand-blue/5 transition-all"
                      title={tHome("editSummary")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
                      <span className="truncate">{summary.subject}</span>
                    </div>
                    {summary.avg_rating != null && summary.avg_rating > 0 && (
                      <div className="flex items-center gap-1 bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        <Star className="w-3 h-3 fill-brand-orange" />
                        <span>{summary.avg_rating}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                    <span className="truncate">
                      {summary.year} - {summary.department}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {summary.content}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
