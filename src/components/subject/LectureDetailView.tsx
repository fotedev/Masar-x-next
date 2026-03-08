import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  FileText,
  LayoutGrid,
  Monitor,
  Plus,
  Trophy,
  Video,
  X,
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

type MaybeCreatedAt = { created_at?: string };

type ContentItem = {
  id?: string;
  title: string;
  url?: string;
  file_url?: string;
  type: "video" | "file" | "summary" | "quiz";
} & MaybeCreatedAt;

export function LectureDetailView(props: {
  isRTL: boolean;
  locale: string;
  isAdmin: boolean;
  user: unknown;
  subjectName?: string;
  selectedLecture: LectureIndexItem | null;
  explanationItems: ContentItem[];
  homeworkItems: ContentItem[];
  examItems: ContentItem[];
  activeVideoUrl: string | null;
  activeVideoTitle: string | null;
  isTheatreMode: boolean;
  completedContent: Set<string>;
  tSubjectPage: (key: string) => string;
  getYouTubeId: (url: string) => string | null;
  onBackToSubjects: () => void;
  onBackToLectures: () => void;
  onToggleTheatreMode: () => void;
  onCloseVideo: () => void;
  onToggleProgress: (contentId: string) => void;
  onViewContent: (item: ContentItem) => void;
  onAddVideo: () => void;
  onAddFile: () => void;
  onAddExam: () => void;
}) {
  const {
    isRTL,
    locale,
    isAdmin,
    user,
    subjectName,
    selectedLecture,
    explanationItems,
    homeworkItems,
    examItems,
    activeVideoUrl,
    activeVideoTitle,
    isTheatreMode,
    completedContent,
    tSubjectPage,
    getYouTubeId,
    onBackToSubjects,
    onBackToLectures,
    onToggleTheatreMode,
    onCloseVideo,
    onToggleProgress,
    onViewContent,
    onAddVideo,
    onAddFile,
    onAddExam,
  } = props;

  const lectureTitle =
    selectedLecture?.label || tSubjectPage("lectureDefaultTitle");

  const formatYmd = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  };

  const createdAtCandidates = [
    ...explanationItems.map((s) => s.created_at),
    ...homeworkItems.map((v) => v.created_at),
    ...examItems.map((f) => f.created_at),
  ]
    .filter(Boolean)
    .map((v) => new Date(v as string))
    .filter((d) => !Number.isNaN(d.getTime()));

  const lectureAddedAt = createdAtCandidates.length
    ? createdAtCandidates.sort((a, b) => a.getTime() - b.getTime())[0]
    : null;

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
      className={`space-y-8 pb-20 ${isRTL ? "text-right" : "text-left"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: -10 },
          show: { opacity: 1, y: 0 },
        }}
        className={`flex flex-col gap-8 ${
          isTheatreMode && activeVideoUrl ? "mx-auto" : ""
        }`}
      >
        {!isTheatreMode && (
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToSubjects}
              className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-blue hover:text-brand-blue transition-all"
              title={`${tSubjectPage("backToSubjects")} ${subjectName || ""}`}
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <button
              onClick={onBackToLectures}
              className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all"
            >
              <LayoutGrid className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
              {tSubjectPage("backToLectures")}
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
                  {tSubjectPage("lectureContent")}
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
                    {explanationItems.length} {tSubjectPage("explanation")}
                  </motion.div>
                  <motion.div
                    layout
                    className="px-4 sm:px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-bold"
                  >
                    {homeworkItems.length} {tSubjectPage("homework")}
                  </motion.div>
                  <motion.div
                    layout
                    className="px-4 sm:px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-bold"
                  >
                    {examItems.length} {tSubjectPage("examLabel")}
                  </motion.div>
                </motion.div>
              </motion.div>

              <motion.div layout className="lg:col-span-4 w-full">
                <div className="lg:border-r lg:border-white/10 lg:pr-10 lg:pt-2">
                  <motion.h3
                    layout
                    className="text-lg font-black text-white/90 mb-5 hidden lg:block"
                  >
                    {tSubjectPage("lectureInfo")}
                  </motion.h3>
                  <motion.div layout className="space-y-4">
                    <motion.div
                      layout
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm font-bold text-white/60">
                        {tSubjectPage("addedDate")}
                      </span>
                      <motion.span
                        layout
                        key={lectureAddedAt ? lectureAddedAt.getTime() : "none"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm font-black text-white"
                      >
                        {lectureAddedAt ? formatYmd(lectureAddedAt) : "—"}
                      </motion.span>
                    </motion.div>
                    <div className="h-px bg-white/10" />
                    <motion.div
                      layout
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm font-bold text-white/60">
                        {tSubjectPage("sourcesCount")}
                      </span>
                      <motion.span
                        layout
                        className="text-sm font-black text-white"
                      >
                        {explanationItems.length}
                      </motion.span>
                    </motion.div>
                    <div className="h-px bg-white/10" />
                    <motion.div
                      layout
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm font-bold text-white/60">
                        {tSubjectPage("exams")}
                      </span>
                      <motion.span
                        layout
                        className="text-sm font-black text-white"
                      >
                        {examItems.length}
                      </motion.span>
                    </motion.div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeVideoUrl && (
          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1 },
            }}
            className={`w-full ${isTheatreMode ? "max-w-none" : ""}`}
          >
            <div
              className={`bg-white dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col ${
                isTheatreMode
                  ? "flex-1 border-none rounded-none"
                  : "rounded-3xl sm:rounded-[2.5rem]"
              }`}
            >
              <div className="p-3 sm:p-4 lg:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate max-w-[150px] sm:max-w-none">
                      {activeVideoTitle}
                    </h3>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400">
                      {tSubjectPage("videoPlayer")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={onToggleTheatreMode}
                    className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors ${
                      isTheatreMode
                        ? "bg-brand-blue text-white"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                    }`}
                    title={
                      isTheatreMode
                        ? tSubjectPage("exitTheatreMode")
                        : tSubjectPage("theatreMode")
                    }
                  >
                    <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={onCloseVideo}
                    className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                  </button>
                </div>
              </div>
              <div
                className={`relative bg-black ${
                  isTheatreMode ? "flex-1" : "aspect-video"
                }`}
              >
                {getYouTubeId(activeVideoUrl) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(
                      activeVideoUrl,
                    )}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&playsinline=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  ></iframe>
                ) : (
                  <video
                    src={activeVideoUrl}
                    controls
                    autoPlay
                    className="absolute inset-0 w-full h-full"
                  ></video>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 },
          }}
          className="lg:col-span-8 space-y-12"
        >
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {tSubjectPage("explanationsAndLessons")}
                </h2>
              </div>
              {isAdmin && (
                <div className="flex gap-2 sm:mr-auto">
                  <button
                    onClick={onAddVideo}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue font-bold text-[10px] sm:text-xs hover:bg-brand-blue hover:text-white transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {tSubjectPage("video")}
                  </button>
                  <button
                    onClick={onAddFile}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-brand-orange/10 text-brand-orange font-bold text-[10px] sm:text-xs hover:bg-brand-orange hover:text-white transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {tSubjectPage("file")}
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
                  <div className="text-slate-400 font-black italic">
                    {tSubjectPage("noExplanationContent")}
                  </div>
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
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-center sm:justify-start gap-3">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {item.type === "video"
                            ? tSubjectPage("contentType.video")
                            : item.type === "summary"
                              ? tSubjectPage("contentType.summary")
                              : tSubjectPage("contentType.file")}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                          {new Date(
                            item.created_at || Date.now(),
                          ).toLocaleDateString(locale)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const contentId =
                            item.id || item.url || item.file_url;
                          if (user && contentId) {
                            onToggleProgress(contentId);
                          }
                        }}
                        className={`p-2.5 rounded-xl transition-all duration-300 relative group/btn shrink-0 ${
                          completedContent.has(
                            item.id || item.url || item.file_url || "",
                          )
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110 animate-bounce"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-500 hover:scale-105 active:scale-95"
                        }`}
                        title="Mark lesson as completed"
                      >
                        <CheckCircle
                          className={`w-5 h-5 transition-all duration-500 ${
                            completedContent.has(
                              item.id || item.url || item.file_url || "",
                            )
                              ? "scale-110"
                              : "group-hover/btn:rotate-12"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => onViewContent(item)}
                        className="flex-1 sm:flex-none px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-brand-blue transition-all"
                      >
                        {tSubjectPage("viewContent")}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          </section>

          {homeworkItems.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                  {tSubjectPage("assignmentsAndHomework")}
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
                          const contentId =
                            item.id || item.url || item.file_url;
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
                            ? tSubjectPage("unmarkCompleted")
                            : tSubjectPage("markAsCompleted")
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
                      {tSubjectPage("downloadHomework")}
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1 },
          }}
          className="lg:col-span-4 space-y-8"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-brand-blue" />
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {tSubjectPage("exams")}
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
                  {tSubjectPage("noExams")}
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
                            ? tSubjectPage("unmarkCompleted")
                            : tSubjectPage("markAsCompleted")
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
                      {tSubjectPage("startChallenge")}
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
                  {tSubjectPage("addExam")}
                </button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
