
import { BookOpen, Video, FileText, Layout, Plus } from "lucide-react";
import { Button } from "@/components/ui";

interface SubjectLecture {
  key: string;
  label: string;
  order: number;
  counts: {
    summaries: number;
    videos: number;
    files: number;
    exams: number;
  };
}

interface SubjectSidebarProps {
  lectures: SubjectLecture[];
  selectedLectureKey: string | null;
  onSelectLecture: (key: string) => void;
  isAdmin: boolean;
  onAddLecture: () => void;
  t: (key: string) => string;
}

export function SubjectSidebar({
  lectures,
  selectedLectureKey,
  onSelectLecture,
  isAdmin,
  onAddLecture,
  t,
}: SubjectSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("lectures")}
        </h2>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddLecture}
            className="h-8 w-8 p-0 rounded-full"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {lectures.map((lecture) => (
          <button
            key={lecture.key}
            onClick={() => onSelectLecture(lecture.key)}
            className={`w-full text-start p-4 rounded-2xl transition-all border-2 ${
              selectedLectureKey === lecture.key
                ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 shadow-md scale-[1.02]"
                : "bg-white border-transparent dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }`}
          >
            <div className="font-bold text-slate-900 dark:text-white mb-2">
              {lecture.label}
            </div>
            <div className="flex flex-wrap gap-3">
              {lecture.counts.summaries > 0 && (
                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <FileText className="w-3 h-3" />
                  {lecture.counts.summaries}
                </div>
              )}
              {lecture.counts.videos > 0 && (
                <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                  <Video className="w-3 h-3" />
                  {lecture.counts.videos}
                </div>
              )}
              {lecture.counts.files > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                  <BookOpen className="w-3 h-3" />
                  {lecture.counts.files}
                </div>
              )}
              {lecture.counts.exams > 0 && (
                <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                  <Layout className="w-3 h-3" />
                  {lecture.counts.exams}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
