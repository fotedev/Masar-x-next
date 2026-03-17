import { ArrowRight, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";

export function LectureHero(props: {
  isTheatreMode: boolean;
  hasActiveVideo: boolean;
  onBackToSubjects: () => void;
  onBackToLectures: () => void;
  backToSubjectsTitle: string;
  backToLecturesLabel: string;
  lectureContentLabel: string;
  lectureTitle: string;
  lectureInfoLabel: string;
  addedDateLabel: string;
  sourcesCountLabel: string;
  examsLabel: string;
  addedDateValue: string;
  sourcesCountValue: number;
  examsCountValue: number;
  explanationCount: number;
  explanationLabel: string;
  homeworkCount: number;
  homeworkLabel: string;
  examCount: number;
  examLabel: string;
}) {
  const {
    isTheatreMode,
    hasActiveVideo,
    onBackToSubjects,
    onBackToLectures,
    backToSubjectsTitle,
    backToLecturesLabel,
    lectureContentLabel,
    lectureTitle,
    lectureInfoLabel,
    addedDateLabel,
    sourcesCountLabel,
    examsLabel,
    addedDateValue,
    sourcesCountValue,
    examsCountValue,
    explanationCount,
    explanationLabel,
    homeworkCount,
    homeworkLabel,
    examCount,
    examLabel,
  } = props;

  return (
    <div
      className={`flex flex-col gap-8 ${isTheatreMode && hasActiveVideo ? "mx-auto" : ""}`}
    >
      {!isTheatreMode && (
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToSubjects}
            className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-blue hover:text-brand-blue transition-all"
            title={backToSubjectsTitle}
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <button
            onClick={onBackToLectures}
            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all"
          >
            <LayoutGrid className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
            {backToLecturesLabel}
          </button>
        </div>
      )}

      {!isTheatreMode && (
        <motion.div
          layout
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1 },
          }}
          className="relative overflow-hidden rounded-3xl sm:rounded-[3rem] bg-slate-900 text-white min-h-[250px] sm:min-h-[350px] flex items-center shadow-2xl shadow-brand-blue/20"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-blue/20 to-transparent" />
          <div className="relative z-10 w-full p-8 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <motion.div layout className="lg:col-span-8 space-y-4">
              <motion.div
                layout
                className="inline-block px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-brand-blue-light font-black text-xs uppercase tracking-[0.2em] mb-2"
              >
                {lectureContentLabel}
              </motion.div>
              <motion.h1
                layout
                key={lectureTitle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight"
              >
                {lectureTitle}
              </motion.h1>
              <motion.div
                layout
                className="flex flex-wrap justify-start gap-3 sm:gap-4 mt-6"
              >
                <motion.div
                  layout
                  className="px-4 sm:px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-bold"
                >
                  {explanationCount} {explanationLabel}
                </motion.div>
                <motion.div
                  layout
                  className="px-4 sm:px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-bold"
                >
                  {homeworkCount} {homeworkLabel}
                </motion.div>
                <motion.div
                  layout
                  className="px-4 sm:px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-bold"
                >
                  {examCount} {examLabel}
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div layout className="lg:col-span-4 w-full">
              <div className="lg:border-r lg:border-white/10 lg:pr-10 lg:pt-2">
                <motion.h3
                  layout
                  className="text-lg font-black text-white/90 mb-5 hidden lg:block"
                >
                  {lectureInfoLabel}
                </motion.h3>
                <motion.div layout className="space-y-4">
                  <motion.div
                    layout
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm font-bold text-white/60">
                      {addedDateLabel}
                    </span>
                    <motion.span
                      layout
                      key={addedDateValue}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-black text-white"
                    >
                      {addedDateValue}
                    </motion.span>
                  </motion.div>
                  <div className="h-px bg-white/10" />
                  <motion.div
                    layout
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm font-bold text-white/60">
                      {sourcesCountLabel}
                    </span>
                    <motion.span
                      layout
                      className="text-sm font-black text-white"
                    >
                      {sourcesCountValue}
                    </motion.span>
                  </motion.div>
                  <div className="h-px bg-white/10" />
                  <motion.div
                    layout
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm font-bold text-white/60">
                      {examsLabel}
                    </span>
                    <motion.span
                      layout
                      className="text-sm font-black text-white"
                    >
                      {examsCountValue}
                    </motion.span>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
