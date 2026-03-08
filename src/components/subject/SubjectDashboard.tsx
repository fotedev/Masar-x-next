import {
  ArrowRight,
  ChevronLeft,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  LayoutGrid,
  MapPin,
  Plus,
  Settings,
  Trophy,
  Video,
} from "lucide-react";
import { motion } from "framer-motion";

type LectureIndexItem = {
  key: string;
  label: string;
  order: number;
  counts: {
    summaries: number;
    videos: number;
    files: number;
    exams: number;
  };
};

type DashboardData = {
  professor: string;
  professorGender?: "male" | "female";
  description: string;
  progress: number;
  schedule: string;
  nextLecture: string;
  totalLectures: string;
};

export function SubjectDashboard(props: {
  isRTL: boolean;
  isAdmin: boolean;
  normalizedSubjectName: string;
  dashboardData: DashboardData;
  lectureIndex: LectureIndexItem[];
  totalPossibleItems: number;
  tSubjectPage: (key: string) => string;
  onBackToSubjects: () => void;
  onEditSubject: () => void;
  onAddLecture: () => void;
  onSelectLecture: (lectureKey: string) => void;
}) {
  const {
    isRTL,
    isAdmin,
    normalizedSubjectName,
    dashboardData,
    lectureIndex,
    totalPossibleItems,
    tSubjectPage,
    onBackToSubjects,
    onEditSubject,
    onAddLecture,
    onSelectLecture,
  } = props;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
            delayChildren: 0.2,
          },
        },
      }}
      className={`space-y-12 pb-12 ${isRTL ? "text-right" : "text-left"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="flex justify-start"
      >
        <button
          onClick={onBackToSubjects}
          className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
        >
          <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
          {tSubjectPage("backToSubjects")}
        </button>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="modern-card p-4 sm:p-10 relative overflow-hidden group shadow-2xl shadow-brand-blue/5 border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-[2.5rem]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-orange/5 opacity-50" />

        <div className="absolute -top-24 -left-24 w-64 h-64 sm:w-96 sm:h-96 bg-brand-blue/10 rounded-full blur-[80px] sm:blur-[100px] animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 sm:w-96 sm:h-96 bg-brand-orange/10 rounded-full blur-[80px] sm:blur-[100px] animate-pulse delay-700" />

        <div className="relative z-10 p-2 sm:p-10">
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-center lg:items-start justify-between">
            <div className="flex-1 space-y-4 sm:space-y-6 w-full">
              <motion.div
                layout
                className={`flex flex-wrap gap-2 ${isRTL ? "justify-start" : "justify-start"}`}
              >
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue-light text-[10px] sm:text-xs font-black shadow-sm ring-1 ring-brand-blue/20`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <motion.span layout>
                    {(() => {
                      const profName = dashboardData.professor || "";
                      const hasTitle = /^(Dr\.|Prof\.|د\.|أ\.د)/i.test(
                        profName,
                      );
                      if (hasTitle) return profName;

                      const label =
                        dashboardData.professorGender === "female"
                          ? tSubjectPage("professorLabelFemale")
                          : tSubjectPage("professorLabelMale");

                      // Handle LTR/RTL spacing for the label and name
                      return isRTL
                        ? `${profName} ${label}`
                        : `${label} ${profName}`;
                    })()}
                  </motion.span>
                </motion.div>
              </motion.div>

              <motion.div
                layout
                className={`space-y-3 ${isRTL ? "text-right" : "text-left"}`}
              >
                <motion.h1
                  layout
                  className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.2] sm:leading-[1.1]"
                >
                  <motion.span
                    layout
                    className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue to-brand-blue/60"
                  >
                    {tSubjectPage("subjectLabel")}
                  </motion.span>{" "}
                  <motion.span layout className="break-words">
                    {normalizedSubjectName}
                  </motion.span>
                </motion.h1>
                {isAdmin && (
                  <motion.button
                    layout
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onEditSubject}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-brand-blue hover:text-white transition-colors mt-2"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {tSubjectPage("editSubject")}
                  </motion.button>
                )}
                <motion.p
                  layout
                  className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium"
                >
                  {dashboardData.description}
                </motion.p>
              </motion.div>

              <div className="flex flex-wrap justify-start gap-4 sm:gap-6 pt-2 sm:pt-4">
                <div
                  className={`flex flex-col gap-1 sm:gap-2 ${isRTL ? "items-start" : "items-start"}`}
                >
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
                    {tSubjectPage("scheduleTitle")}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-brand-blue animate-pulse" />
                    {dashboardData.schedule}
                  </div>
                </div>
                <div
                  className={`flex flex-col gap-1 sm:gap-2 ${isRTL ? "items-start" : "items-start"}`}
                >
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
                    {tSubjectPage("locationTitle")}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-brand-orange" />
                    {dashboardData.nextLecture}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative group/progress shrink-0">
              <div className="absolute inset-0 bg-brand-blue/20 blur-[30px] sm:blur-[40px] rounded-full scale-75 group-hover/progress:scale-100 transition-transform duration-700" />
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow-xl border-4 border-slate-50 dark:border-slate-800">
                <svg className="w-24 h-24 sm:w-32 sm:h-32 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800 lg:hidden"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={263.8}
                    strokeDashoffset={
                      263.8 - (263.8 * dashboardData.progress) / 100
                    }
                    className="transition-all duration-1000 ease-out lg:hidden"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800 hidden lg:block"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="url(#progressGradient)"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={364.4}
                    strokeDashoffset={
                      364.4 - (364.4 * dashboardData.progress) / 100
                    }
                    className="transition-all duration-1000 ease-out hidden lg:block"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient
                      id="progressGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#2dd4bf" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    {dashboardData.progress}%
                  </span>
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    {tSubjectPage("yourProgress")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

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
                  {lectureIndex.length}
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
                {dashboardData.totalLectures.split("/")[0]}
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
              <motion.button
                key={lec.key}
                variants={{
                  hidden: { opacity: 0, scale: 0.95 },
                  show: { opacity: 1, scale: 1 },
                }}
                whileHover={{ scale: 1.02, translateY: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectLecture(lec.key)}
                className="group relative flex flex-col p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500 hover:shadow-2xl hover:shadow-brand-blue/10 text-right"
              >
                <div className="flex justify-between items-start mb-6 w-full">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand-blue transition-all duration-500 shadow-sm">
                    <span className="text-xl font-black text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-slate-50 dark:border-slate-800 flex items-center justify-center group-hover:border-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all duration-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
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
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
