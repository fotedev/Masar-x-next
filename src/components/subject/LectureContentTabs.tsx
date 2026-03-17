import { ExternalLink, Trash2 } from "lucide-react";
import type { ContentItem } from "@/hooks/useLectureContent";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface VideosListProps {
  videos: ContentItem[];
  onDelete: (id: string) => void;
  t: TranslationFn;
}

export function VideosList({ videos, onDelete, t }: VideosListProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
        {t("noLecturesYet")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {videos.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
        >
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {v.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {v.language === "en" ? "English" : "عربي"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={v.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
              title={t("lectureForm.viewContent")}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => onDelete(v.id)}
              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
              title={t("lectureForm.delete")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SummariesListProps {
  summaries: ContentItem[];
  t: TranslationFn;
}

export function SummariesList({ summaries, t }: SummariesListProps) {
  if (summaries.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
        {t("noLecturesYet")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summaries.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
        >
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {s.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("lectureForm.status")}: {s.status}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

interface FilesListProps {
  files: ContentItem[];
  onDelete: (id: string) => void;
  t: TranslationFn;
}

export function FilesList({ files, onDelete, t }: FilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
        {t("noLecturesYet")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
        >
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {f.title}
            </span>
            {f.description ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {f.description}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={f.file_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
              title={t("lectureForm.viewContent")}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => onDelete(f.id)}
              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
              title={t("lectureForm.delete")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface QuizzesListProps {
  quizzes: ContentItem[];
  onDelete: (id: string) => void;
  t: TranslationFn;
}

export function QuizzesList({ quizzes, onDelete, t }: QuizzesListProps) {
  if (quizzes.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
        {t("noExams")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {quizzes.map((q) => (
        <div
          key={q.id}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
        >
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {q.title}
            </span>
          </div>
          <button
            onClick={() => onDelete(q.id)}
            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
            title={t("lectureForm.delete")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
