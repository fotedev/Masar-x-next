"use client";

import { BookOpen, Calendar, Star, Play } from "lucide-react";
import { motion } from "framer-motion";
import { VideoWithRatings } from "@/types/database";

interface VideosSectionProps {
  loading: boolean;
  subjectsLoading: boolean;
  displayVideos: VideoWithRatings[];
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

export function VideosSection({
  loading,
  subjectsLoading,
  displayVideos,
  tHome,
  onNavigate,
}: VideosSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {tHome("topLectures")}
        </h2>
        <button
          onClick={() => onNavigate("subjects")}
          className="text-brand-blue hover:text-brand-sky text-sm font-semibold transition-colors flex items-center gap-1"
        >
          {tHome("viewSubjects")}
          <span className="text-lg">←</span>
        </button>
      </div>

      {loading || subjectsLoading ? (
        <div className="summary-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="modern-card p-5 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-3"></div>
              <div className="space-y-3 mb-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : displayVideos.length === 0 ? (
        <div className="modern-card p-12 text-center">
          <Play className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {tHome("goToSubjects")}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="summary-grid"
        >
          {displayVideos.map((video) => (
            <motion.div
              key={video.id}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="modern-card p-5 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
              onClick={() =>
                onNavigate("subjects", encodeURIComponent(video.subject))
              }
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-brand-blue transition-colors">
                  {video.title}
                </h3>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
                    <span className="truncate">{video.subject}</span>
                  </div>
                  {video.avg_rating != null && video.avg_rating > 0 && (
                    <div className="flex items-center gap-1 bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg text-[10px] font-bold">
                      <Star className="w-3 h-3 fill-brand-orange" />
                      <span>{video.avg_rating}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="truncate text-xs">
                    {new Date(video.created_at).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 leading-relaxed">
                  {video.reviews_count
                    ? `${video.reviews_count} تقييم`
                    : "لم يتم تقييمها بعد"}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
