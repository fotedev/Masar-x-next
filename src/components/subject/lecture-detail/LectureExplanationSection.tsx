import { CheckCircle, FileText, Plus, Video } from "lucide-react";
import { motion } from "framer-motion";
import type { ContentItem } from "./types";

export function LectureExplanationSection(props: {
  explanationItems: ContentItem[];
  completedContent: Set<string>;
  locale: string;
  user: unknown;
  isAdmin: boolean;
  onAddVideo: () => void;
  onAddFile: () => void;
  onToggleProgress: (contentId: string) => void;
  onViewContent: (item: ContentItem) => void;
  title: string;
  videoLabel: string;
  fileLabel: string;
  noContentLabel: string;
  viewContentLabel: string;
  contentTypeVideoLabel: string;
  contentTypeSummaryLabel: string;
  contentTypeFileLabel: string;
  liveTag: string;
  markLessonAsCompletedLabel: string;
  unmarkLessonCompletedLabel: string;
}) {
  const {
    explanationItems,
    completedContent,
    locale,
    user,
    isAdmin,
    onAddVideo,
    onAddFile,
    onToggleProgress,
    onViewContent,
    title,
    videoLabel,
    fileLabel,
    noContentLabel,
    viewContentLabel,
    contentTypeVideoLabel,
    contentTypeSummaryLabel,
    contentTypeFileLabel,
    unmarkLessonCompletedLabel,
    markLessonAsCompletedLabel,
  } = props;

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
            <Video className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>
        {isAdmin && (
          <div className="flex gap-2 sm:mr-auto">
            <button
              onClick={onAddVideo}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue font-bold text-[10px] sm:text-xs hover:bg-brand-blue hover:text-white transition-all"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {videoLabel}
            </button>
            <button
              onClick={onAddFile}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-orange/10 text-brand-orange font-bold text-[10px] sm:text-xs hover:bg-brand-orange hover:text-white transition-all"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {fileLabel}
            </button>
          </div>
        )}
      </div>

      <motion.div
        className="grid grid-cols-1 gap-4"
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
        {explanationItems.length === 0 ? (
          <div className="p-12 text-center rounded-[2.5rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 font-black italic">{noContentLabel}</div>
          </div>
        ) : (
          explanationItems.map((item, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1 },
              }}
              whileHover={{ scale: 1.01 }}
              className="group flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-brand-blue/5"
            >
              <div
                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center shrink-0 ${
                  item.type === "video"
                    ? "bg-red-50 text-red-500"
                    : "bg-brand-blue/5 text-brand-blue"
                }`}
              >
                {item.type === "video" ? (
                  <Video className="w-6 h-6 sm:w-8 sm:h-8" />
                ) : (
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
                )}
              </div>
              <div className="flex-1 text-center sm:text-right w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                  {item.type === "video" && (
                    <span className="inline-block self-center sm:self-auto px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black">
                      {props.liveTag}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {item.type === "video"
                      ? contentTypeVideoLabel
                      : item.type === "summary"
                        ? contentTypeSummaryLabel
                        : contentTypeFileLabel}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                    {new Date(item.created_at || Date.now()).toLocaleDateString(
                      locale,
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const contentId = item.id || item.url || item.file_url;
                    if (user && contentId) {
                      onToggleProgress(contentId);
                    }
                  }}
                  className={`p-2.5 rounded-xl transition-all duration-300 relative group/btn shrink-0 ${
                    completedContent.has(item.id || item.url || item.file_url || "")
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110 animate-bounce"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-500 hover:scale-105 active:scale-95"
                  }`}
                  title={
                    completedContent.has(item.id || item.url || item.file_url || "")
                      ? unmarkLessonCompletedLabel
                      : markLessonAsCompletedLabel
                  }
                >
                  <CheckCircle
                    className={`w-5 h-5 transition-all duration-500 ${
                      completedContent.has(item.id || item.url || item.file_url || "")
                        ? "scale-110"
                        : "group-hover/btn:rotate-12"
                    }`}
                  />
                </button>
                <button
                  onClick={() => onViewContent(item)}
                  className="flex-1 sm:flex-none px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-brand-blue transition-all"
                >
                  {viewContentLabel}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </section>
  );
}
