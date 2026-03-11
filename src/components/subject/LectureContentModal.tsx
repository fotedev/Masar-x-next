import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  BookOpen,
  FileText,
  Video,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { useLectureContent } from "@/hooks/useLectureContent";
import {
  SummariesList,
  VideosList,
  FilesList,
  QuizzesList,
} from "./LectureContentTabs";
import { confirmToast } from "@/lib/confirmToast";
import { supabase } from "@/lib/supabase";
import { queryCache, cacheKeys } from "@/lib/queryCache";

interface LectureContentModalProps {
  show: boolean;
  onClose: () => void;
  subject: string;
  lecture: any | null;
  lecturesIndex: any[];
}

export function LectureContentModal({
  show,
  onClose,
  subject,
  lecture,
  lecturesIndex,
}: LectureContentModalProps) {
  const t = useTranslations("subjectPage");
  const [activeTab, setActiveTab] = useState<
    "summaries" | "videos" | "files" | "quizzes"
  >("summaries");

  const {
    loading,
    summaries,
    videos,
    files,
    quizzes,
    setVideos,
    setFiles,
    setQuizzes,
    lectureKey,
  } = useLectureContent({ show, subject, lecture, lecturesIndex });

  const lectureLabel =
    (lecture?.lecture_label || "").trim() || t("lectureForm.uncategorized");

  const openSubjectLecture = () => {
    const url = `/subjects/${encodeURIComponent(subject)}?lecture=${encodeURIComponent(lectureKey)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteVideo = async (id: string) => {
    const confirmed = await confirmToast(t("lectureForm.confirmDelete"), {
      confirmLabel: t("lectureForm.delete"),
      cancelLabel: t("lectureForm.cancel"),
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (!error) {
        setVideos((p) => p.filter((v) => v.id !== id));
        const cacheKey = cacheKeys.videos?.() || "videos";
        if (queryCache.invalidate) {
          queryCache.invalidate(cacheKey);
        }
      }
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const handleDeleteFile = async (id: string) => {
    const confirmed = await confirmToast(t("lectureForm.confirmDelete"), {
      confirmLabel: t("lectureForm.delete"),
      cancelLabel: t("lectureForm.cancel"),
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("files").delete().eq("id", id);
      if (!error) {
        setFiles((p) => p.filter((f) => f.id !== id));
        const cacheKey = cacheKeys.files?.() || "files";
        if (queryCache.invalidate) {
          queryCache.invalidate(cacheKey);
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    const confirmed = await confirmToast(t("lectureForm.confirmDelete"), {
      confirmLabel: t("lectureForm.delete"),
      cancelLabel: t("lectureForm.cancel"),
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (!error) {
        setQuizzes((p) => p.filter((q) => q.id !== id));
        if (queryCache.invalidate) {
          queryCache.invalidate("quizzes");
        }
      }
    } catch (error) {
      console.error("Error deleting quiz:", error);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("lectureContent")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subject} • {lectureLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openSubjectLecture}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              title={t("lectureForm.viewContent")}
            >
              <ExternalLink className="w-4 h-4" />
              {t("lectureForm.viewContent")}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("summaries")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "summaries"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            {t("lectures")} ({summaries.length})
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "videos"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <Video className="w-4 h-4" />
            {t("contentType.video")} ({videos.length})
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "files"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            {t("contentType.file")} ({files.length})
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "quizzes"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            {t("exams")} ({quizzes.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : activeTab === "summaries" ? (
            <SummariesList summaries={summaries} t={t} />
          ) : activeTab === "videos" ? (
            <VideosList videos={videos} onDelete={handleDeleteVideo} t={t} />
          ) : activeTab === "files" ? (
            <FilesList files={files} onDelete={handleDeleteFile} t={t} />
          ) : (
            <QuizzesList quizzes={quizzes} onDelete={handleDeleteQuiz} t={t} />
          )}
        </div>
      </div>
    </div>
  );
}
