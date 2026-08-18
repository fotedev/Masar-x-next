"use client";

import { FileText, BookOpen, Calendar, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SummaryWithRatings } from "@/types/database";
import { SummaryWithRatingsOptimistic } from "@/hooks/useSummaries";
import { useLocale } from "next-intl";
import { Skeleton } from "../ui/Skeleton";

interface SummariesSectionProps {
  loading: boolean;
  subjectsLoading: boolean;
  displaySummaries: SummaryWithRatingsOptimistic[];
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
  const shouldReduceMotion = useReducedMotion();
  const isRTL = locale === "ar";
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
            <div key={i} className="modern-card p-5 h-[180px]">
              <div className="flex justify-between items-start mb-3">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" />
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Skeleton className="h-4 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : displaySummaries.length === 0 ? (
        <div className="modern-card p-10 sm:p-12 text-center flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/20 border-dashed border-2 border-slate-200 dark:border-slate-800 rounded-[32px]">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-sm flex items-center justify-center mb-6 ring-8 ring-slate-50 dark:ring-slate-900/50">
            <FileText className="w-10 h-10 text-brand-blue opacity-40" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-relaxed">
            {tHome("noFavoriteSummaries")}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-[280px] mx-auto text-sm leading-relaxed">
            {tHome("noFavoriteSummariesHint")}
          </p>
          <button
            onClick={() => onNavigate("subjects")}
            className="px-8 py-3 bg-brand-blue text-white rounded-2xl font-bold hover:bg-brand-sky shadow-lg shadow-brand-blue/20 transition-all duration-300 active:scale-95"
          >
            {tHome("goToSubjects")}
          </button>
        </div>
      ) : (
        <motion.div
          variants={
            shouldReduceMotion
              ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
              : containerVariants
          }
          initial="hidden"
          animate="show"
          className="summary-grid"
        >
          {displaySummaries.map((summary: SummaryWithRatingsOptimistic) => {
            const canEdit = user && (isAdmin || summary.user_id === user.id);

            return (
              <motion.div
                key={summary.id}
                variants={shouldReduceMotion ? { hidden: {}, show: {} } : itemVariants}
                whileHover={
                  !shouldReduceMotion && !summary.isOptimistic ? { y: -4 } : {}
                }
                className={`modern-card p-5 transition-[colors,transform,box-shadow,border-color] duration-300
                  ${summary.isOptimistic 
                    ? "opacity-60 cursor-not-allowed border-dashed border-brand-blue/30 animate-pulse" 
                    : "cursor-pointer group hover:border-brand-blue/50"
                  }`}
                onClick={() => {
                  if (summary.isOptimistic) return;
                  trackSummaryClick(summary.id, "trending_click");
                  onNavigate("summaries", summary.id);
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className={`text-base font-bold line-clamp-2 transition-colors
                    ${summary.isOptimistic ? "text-slate-400" : "text-slate-900 dark:text-white group-hover:text-brand-blue"}`}>
                    {summary.title}
                    {summary.isOptimistic && (
                      <span className="block text-[10px] mt-1 font-medium animate-pulse">
                        جاري الرفع...
                      </span>
                    )}
                  </h3>
                  {canEdit && !summary.isOptimistic && (
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

                <div className={`pt-4 border-t border-slate-100 dark:border-slate-800
                  ${isRTL ? 'leading-relaxed' : 'leading-normal'}`}>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
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
