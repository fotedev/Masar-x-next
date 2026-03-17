import { CheckCircle, ClipboardList, FileText } from "lucide-react";
import { motion } from "framer-motion";
import type { ContentItem } from "./types";

export function LectureHomeworkSection(props: {
  homeworkItems: ContentItem[];
  completedContent: Set<string>;
  onToggleProgress: (contentId: string) => void;
  title: string;
  downloadHomeworkLabel: string;
  markAsCompletedLabel: string;
  unmarkCompletedLabel: string;
}) {
  const {
    homeworkItems,
    completedContent,
    onToggleProgress,
    title,
    downloadHomeworkLabel,
    markAsCompletedLabel,
    unmarkCompletedLabel,
  } = props;

  if (homeworkItems.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
          <ClipboardList className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-6"
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
        {homeworkItems.map((item, idx) => (
          <motion.div
            key={idx}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 },
            }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            className="p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-brand-orange to-brand-orange-light text-white shadow-lg group transition-all duration-500 text-right"
          >
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 opacity-40" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const contentId = item.id || item.url || item.file_url;
                  if (contentId) onToggleProgress(contentId);
                }}
                className={`p-2.5 rounded-xl transition-all duration-300 relative group/btn ${
                  completedContent.has(
                    item.id || item.url || item.file_url || "",
                  )
                    ? "bg-white text-emerald-600 shadow-lg scale-110"
                    : "bg-white/10 text-white/60 hover:bg-white/20 hover:scale-105"
                }`}
                title={
                  completedContent.has(
                    item.id || item.url || item.file_url || "",
                  )
                    ? unmarkCompletedLabel
                    : markAsCompletedLabel
                }
              >
                <CheckCircle
                  className={`w-5 h-5 transition-all duration-500 ${
                    completedContent.has(
                      item.id || item.url || item.file_url || "",
                    )
                      ? "scale-110 rotate-[360deg] text-emerald-600"
                      : "group-hover/btn:rotate-12"
                  }`}
                />
                {completedContent.has(
                  item.id || item.url || item.file_url || "",
                ) && (
                  <span className="absolute inset-0 rounded-xl animate-ping-slow bg-white/40 pointer-events-none" />
                )}
              </button>
            </div>
            <h4 className="text-xl font-black mb-4">{item.title}</h4>
            <button
              onClick={() => {
                if (item.file_url) {
                  window.open(item.file_url, "_blank");
                }
              }}
              className="w-full py-3 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 font-black text-sm hover:bg-white/30 transition-all"
            >
              {downloadHomeworkLabel}
            </button>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
