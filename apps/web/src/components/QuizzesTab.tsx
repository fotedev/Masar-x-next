import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { QuizWithRatings } from "../types/database";
import { QuizFilters } from "./quizzes/QuizFilters";
import { QuizCard } from "./quizzes/QuizCard";

interface QuizzesTabProps {
  quizzes: QuizWithRatings[];
  onDeleteQuiz: (id: string) => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
}

export function QuizzesTab({
  quizzes,
  onDeleteQuiz,
  onUpdateStatus,
}: QuizzesTabProps) {
  const t = useTranslations("quizzes");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered and sorted quizzes
  const filteredQuizzes = useMemo(() => {
    let filtered = [...quizzes];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (quiz.description &&
            quiz.description.toLowerCase().includes(searchTerm.toLowerCase())),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "date":
        default:
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [quizzes, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredQuizzes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentQuizzes = filteredQuizzes.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder]);

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t("noExams")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{t("noExamsSoon")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuizFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        filteredCount={filteredQuizzes.length}
        totalCount={quizzes.length}
        t={t}
      />

      {/* Quizzes List */}
      <div className="space-y-4">
        {currentQuizzes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t("noResults")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("noResultsDesc")}
            </p>
          </div>
        ) : (
          currentQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onDelete={onDeleteQuiz}
              onUpdateStatus={onUpdateStatus}
              t={t}
            />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t("viewCount", {
                  start: startIndex + 1,
                  end: Math.min(endIndex, filteredQuizzes.length),
                  total: filteredQuizzes.length,
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
