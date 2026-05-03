import { motion } from "framer-motion";
import {
  ArrowRight,
  GraduationCap,
  Settings,
  Clock,
  MapPin,
} from "lucide-react";

interface DashboardHeroProps {
  isRTL: boolean;
  isAdmin: boolean;
  normalizedSubjectName: string;
  dashboardData: {
    professor: string;
    professorAr?: string | null;
    professorGender?: "male" | "female";
    description: string;
    descriptionAr?: string | null;
    schedule: string;
    nextLecture: string;
    progress: number;
  };
  tSubjectPage: (key: string) => string;
  onBackToSubjects: () => void;
  onEditSubject: () => void;
}

export function DashboardHero({
  isRTL,
  isAdmin,
  normalizedSubjectName,
  dashboardData,
  tSubjectPage,
  onBackToSubjects,
  onEditSubject,
}: DashboardHeroProps) {
  return (
    <>
      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="flex justify-start"
      >
        <button
          onClick={onBackToSubjects}
          className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
        >
          <ArrowRight
            className={`w-5 h-5 ${isRTL ? "" : "rotate-180"} group-hover:-translate-x-1 transition-transform duration-300`}
          />
          {tSubjectPage("backToSubjects")}
        </button>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="modern-card p-4 sm:p-10 relative overflow-hidden group shadow-2xl shadow-brand-blue/5 border-slate-100 dark:border-slate-800 rounded-3xl sm:rounded-[2.5rem]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-orange/5 opacity-50" />
        <div className="absolute -top-24 -left-24 w-64 h-64 sm:w-96 sm:h-96 bg-brand-blue/10 rounded-full blur-[80px] sm:blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 sm:w-96 sm:h-96 bg-brand-orange/10 rounded-full blur-[80px] sm:blur-[100px]" />

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
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue-light text-[10px] sm:text-xs font-black shadow-sm ring-1 ring-brand-blue/20"
                >
                  <GraduationCap className="w-4 h-4" />
                  <motion.span layout>
                    {(() => {
                      const profName = isRTL
                        ? dashboardData.professorAr ||
                          dashboardData.professor ||
                          ""
                        : dashboardData.professor || "";

                      if (!profName) return "";

                      const hasTitle =
                        /^(Dr\.|Prof\.|د\.|أ\.د|د\/|أ\.د\/)/i.test(
                          profName.trim(),
                        );

                      if (hasTitle) return profName;

                      const label =
                        dashboardData.professorGender === "female"
                          ? tSubjectPage("professorLabelFemale")
                          : tSubjectPage("professorLabelMale");

                      const finalLabel = label.startsWith("subjectPage.")
                        ? dashboardData.professorGender === "female"
                          ? isRTL
                            ? "دكتورة"
                            : "Dr."
                          : isRTL
                            ? "دكتور"
                            : "Dr."
                        : label;

                      return `${finalLabel} ${profName}`;
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
                    className="text-brand-blue dark:text-blue-400"
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
                  {isRTL
                    ? dashboardData.descriptionAr || dashboardData.description
                    : dashboardData.description}
                </motion.p>
              </motion.div>

              <div className="flex flex-wrap justify-start gap-4 sm:gap-6 pt-2 sm:pt-4">
                <div className="flex flex-col gap-1 sm:gap-2 items-start">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
                    {tSubjectPage("scheduleTitle")}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-base sm:text-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-brand-blue" />
                    {dashboardData.schedule}
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:gap-2 items-start">
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
    </>
  );
}
