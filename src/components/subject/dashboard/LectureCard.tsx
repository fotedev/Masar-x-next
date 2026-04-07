import { motion } from "framer-motion";
import { ChevronLeft, FileText, Video, Trophy, Clock } from "lucide-react";

interface LectureCardProps {
  lec: {
    key: string;
    label: string;
    counts: {
      summaries: number;
      videos: number;
      exams: number;
    };
  };
  idx: number;
  tSubjectPage: (key: string) => string;
  onSelectLecture: (lectureKey: string) => void;
}

export function LectureCard({
  lec,
  idx,
  tSubjectPage,
  onSelectLecture,
}: LectureCardProps) {
  return (
    <button
      onClick={() => onSelectLecture(lec.key)}
      className="cursor-pointer text-start w-full group/btn focus-visible:ring-2 focus-visible:ring-brand-blue/30 outline-none rounded-[2.5rem]"
      type="button"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, scale: 0.95 },
          show: { opacity: 1, scale: 1 },
        }}
        whileHover={{ scale: 1.02, translateY: -4 }}
        whileTap={{ scale: 0.98 }}
        className="group relative flex flex-col p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-[colors,box-shadow,border-color] duration-500 hover:shadow-2xl hover:shadow-brand-blue/10 text-right h-full"
      >
        <div className="flex justify-between items-start mb-6 w-full">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand-blue transition-colors duration-500 shadow-sm">
            <span className="text-xl font-black text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">
              {(idx + 1).toString().padStart(2, "0")}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-slate-50 dark:border-slate-800 flex items-center justify-center group-hover:border-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors transition-transform duration-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
            <ChevronLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-2 leading-tight">
            {lec.label}
          </h3>

          <div className="flex flex-wrap gap-2">
            {lec.counts.summaries > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[10px] font-black text-blue-600 dark:text-blue-400">
                <FileText className="w-3 h-3" />
                {lec.counts.summaries} {tSubjectPage("summary")}
              </div>
            )}
            {lec.counts.videos > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 dark:bg-red-900/20 text-[10px] font-black text-red-600 dark:text-red-400">
                <Video className="w-3 h-3" />
                {lec.counts.videos} {tSubjectPage("video")}
              </div>
            )}
            {lec.counts.exams > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-green-50 dark:bg-green-900/20 text-[10px] font-black text-green-600 dark:text-green-400">
                <Trophy className="w-3 h-3" />
                {lec.counts.exams} {tSubjectPage("examLabel")}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {tSubjectPage("updatedRecently")}
          </span>
          <span className="group-hover:text-brand-blue transition-colors">
            {tSubjectPage("viewDetails")}
          </span>
        </div>
      </motion.div>
    </button>
  );
}
