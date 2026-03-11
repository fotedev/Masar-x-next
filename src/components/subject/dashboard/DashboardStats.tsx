import { motion } from "framer-motion";
import { LayoutGrid, Trophy, Layers } from "lucide-react";

interface DashboardStatsProps {
  lectureCount: number;
  totalLectures: string;
  totalPossibleItems: number;
  tSubjectPage: (key: string) => string;
}

export function DashboardStats({
  lectureCount,
  totalLectures,
  totalPossibleItems,
  tSubjectPage,
}: DashboardStatsProps) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      className="grid grid-cols-1 md:grid-cols-4 gap-4"
    >
      <div className="md:col-span-2 relative overflow-hidden group rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6 text-white shadow-lg hover:-translate-y-1 transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2.5 sm:p-3 rounded-xl bg-white/10 backdrop-blur-md">
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-brand-blue" />
            </div>
            <div className="text-left">
              <span className="block text-2xl sm:text-3xl font-black">
                {lectureCount}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-white/60 uppercase">
                {tSubjectPage("lecture")}
              </span>
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <h3 className="text-lg sm:text-xl font-black mb-0.5 sm:mb-1">
              {tSubjectPage("exploreContent")}
            </h3>
            <p className="text-[10px] sm:text-xs text-white/60 leading-relaxed">
              {tSubjectPage("exploreContentDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative group rounded-[1.5rem] sm:rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-md hover:-translate-y-1 transition-all duration-500 overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-20 h-20 sm:w-24 sm:h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
        <div className="relative z-10 flex flex-col h-full items-center text-center">
          <div className="p-2.5 sm:p-3 rounded-xl bg-green-500/10 text-green-500 mb-3 sm:mb-4 group-hover:bg-green-500 group-hover:text-white transition-all duration-500">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {totalLectures.split("/")[0]}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {tSubjectPage("achievements")}
            </span>
          </div>
        </div>
      </div>

      <div className="relative group rounded-[1.5rem] sm:rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-md hover:-translate-y-1 transition-all duration-500 overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-20 h-20 sm:w-24 sm:h-24 bg-brand-orange/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
        <div className="relative z-10 flex flex-col h-full items-center text-center">
          <div className="p-2.5 sm:p-3 rounded-xl bg-brand-orange/10 text-brand-orange mb-3 sm:mb-4 group-hover:bg-brand-orange group-hover:text-white transition-all duration-500">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="block text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {totalPossibleItems}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {tSubjectPage("lectures")}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
