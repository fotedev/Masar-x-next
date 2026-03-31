
import { Plus } from "lucide-react";

interface QuizDashboardHeaderProps {
  isAdmin: boolean;
  t: (key: string) => string;
  onNewExam: () => void;
}

export function QuizDashboardHeader({
  isAdmin,
  t,
  onNewExam,
}: QuizDashboardHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 
          className="text-3xl font-bold text-gray-900 dark:text-white"
          dir="auto"
        >
          {isAdmin ? t("manageExams") : t("exams")}
        </h1>
        <p 
          className="text-gray-600 dark:text-gray-400 mt-2"
          dir="auto"
        >
          {isAdmin ? t("manageExamsDesc") : t("browseExamsDesc")}
        </p>
      </div>
      {isAdmin && (
        <button
          onClick={onNewExam}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t("newExam")}
        </button>
      )}
    </div>
  );
}
