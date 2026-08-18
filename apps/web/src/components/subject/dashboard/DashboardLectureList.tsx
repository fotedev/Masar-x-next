import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { LectureCard } from "./LectureCard";

type LectureIndexItem = {
  key: string;
  label: string;
  counts: {
    summaries: number;
    videos: number;
    exams: number;
  };
};

interface DashboardLectureListProps {
  isRTL: boolean;
  isAdmin: boolean;
  lectureIndex: LectureIndexItem[];
  tSubjectPage: (key: string) => string;
  onAddLecture: () => void;
  onSelectLecture: (lectureKey: string) => void;
}

export function DashboardLectureList({
  isRTL,
  isAdmin,
  lectureIndex,
  tSubjectPage,
  onAddLecture,
  onSelectLecture,
}: DashboardLectureListProps) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className={`space-y-1 ${isRTL ? "text-right" : "text-left"}`}>
          <div className="flex items-center gap-2 text-brand-blue font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] justify-start">
            {!isRTL && <div className="w-4 sm:w-6 h-[1.5px] bg-brand-blue" />}
            {tSubjectPage("educationalContent")}
            {isRTL && <div className="w-4 sm:w-6 h-[1.5px] bg-brand-blue" />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {tSubjectPage("lecturesList")}
          </h2>
        </div>

        {isAdmin && (
          <button
            onClick={onAddLecture}
            className="group flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-brand-blue text-white font-black hover:shadow-xl hover:shadow-brand-blue/30 transition-all active:scale-95 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
            {tSubjectPage("addNewLecture")}
          </button>
        )}
      </div>

      {lectureIndex.length === 0 ? (
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {tSubjectPage("noLecturesYet")}
          </h3>
          <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            {tSubjectPage("contentWillAppear")}
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
        >
          {lectureIndex.map((lec, idx) => (
            <LectureCard
              key={lec.key}
              lec={lec}
              idx={idx}
              tSubjectPage={tSubjectPage}
              onSelectLecture={onSelectLecture}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
