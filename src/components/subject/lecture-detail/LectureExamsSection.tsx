import { ArrowLeft, CheckCircle, Plus, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import type { ContentItem } from "./types";

export function LectureExamsSection(props: {
  isRTL: boolean;
  examItems: ContentItem[];
  completedContent: Set<string>;
  isAdmin: boolean;
  onToggleProgress: (contentId: string) => void;
  onViewContent: (item: ContentItem) => void;
  onAddExam: () => void;
  title: string;
  noExamsLabel: string;
  markAsCompletedLabel: string;
  unmarkCompletedLabel: string;
  startChallengeLabel: string;
  addExamLabel: string;
}) {
  const {
    isRTL,
    examItems,
    completedContent,
    isAdmin,
    onToggleProgress,
    onViewContent,
    onAddExam,
    title,
    noExamsLabel,
    markAsCompletedLabel,
    unmarkCompletedLabel,
    startChallengeLabel,
    addExamLabel,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Trophy className="w-6 h-6 text-brand-blue" />
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
          {title}
        </h3>
      </div>

      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {examItems.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 font-bold italic">
            {noExamsLabel}
          </div>
        ) : (
          examItems.map((item, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, x: isRTL ? -20 : 20 },
                show: { opacity: 1, x: 0 },
              }}
              whileHover={{ scale: 1.02 }}
              className="group p-6 rounded-[2rem] bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-black text-slate-900 dark:text-white leading-tight">
                  {item.title}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.id) onToggleProgress(item.id);
                  }}
                  className={`p-2.5 rounded-xl transition-all duration-300 relative group/btn ${
                    completedContent.has(item.id || "")
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-500 hover:scale-105"
                  }`}
                  title={
                    completedContent.has(item.id || "")
                      ? unmarkCompletedLabel
                      : markAsCompletedLabel
                  }
                >
                  <CheckCircle
                    className={`w-5 h-5 transition-all duration-500 ${
                      completedContent.has(item.id || "")
                        ? "scale-110 rotate-[360deg] text-white"
                        : "group-hover/btn:rotate-12"
                    }`}
                  />
                  {completedContent.has(item.id || "") && (
                    <span className="absolute inset-0 rounded-xl animate-ping-slow bg-emerald-400/40 pointer-events-none" />
                  )}
                </button>
              </div>
              <button
                onClick={() => onViewContent(item)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-blue text-white font-black text-sm group-hover:shadow-lg group-hover:shadow-brand-blue/30 transition-all"
              >
                {startChallengeLabel}
                <ArrowLeft className="w-4 h-4 mr-2" />
              </button>
            </motion.div>
          ))
        )}

        {isAdmin && (
          <button
            onClick={onAddExam}
            className="w-full flex items-center justify-center gap-2 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-brand-blue hover:text-brand-blue transition-all font-black"
          >
            <Plus className="w-5 h-5" />
            {addExamLabel}
          </button>
        )}
      </motion.div>
    </div>
  );
}
