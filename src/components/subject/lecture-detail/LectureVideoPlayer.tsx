import { Monitor, Video, X } from "lucide-react";
import { motion } from "framer-motion";

export function LectureVideoPlayer(props: {
  activeVideoUrl: string | null;
  activeVideoTitle: string | null;
  isTheatreMode: boolean;
  getYouTubeId: (url: string) => string | null;
  onToggleTheatreMode: () => void;
  onCloseVideo: () => void;
  theatreModeLabel: string;
  exitTheatreModeLabel: string;
  videoPlayerLabel: string;
}) {
  const {
    activeVideoUrl,
    activeVideoTitle,
    isTheatreMode,
    getYouTubeId,
    onToggleTheatreMode,
    onCloseVideo,
    theatreModeLabel,
    exitTheatreModeLabel,
    videoPlayerLabel,
  } = props;

  if (!activeVideoUrl) return null;

  return (
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
                {videoPlayerLabel}
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
              title={isTheatreMode ? exitTheatreModeLabel : theatreModeLabel}
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
  );
}
