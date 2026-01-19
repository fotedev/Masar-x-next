import { useState, useMemo } from "react";
import {
  Eye,
  Trash2,
  Search,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Star,
} from "lucide-react";
import { QuizWithRatings } from "../types/database";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered and sorted quizzes
  const filteredQuizzes = useMemo(() => {
    let filtered = quizzes;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (quiz.description && quiz.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "date":
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
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
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder]);

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد امتحانات
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            لا توجد امتحانات حالياً
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          إدارة الامتحانات ({filteredQuizzes.length} من {quizzes.length})
        </h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="البحث في العنوان أو الوصف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Sort */}
          <div className="w-full lg:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="date">ترتيب بالتاريخ</option>
              <option value="title">ترتيب بالعنوان</option>
            </select>
          </div>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {sortOrder === "asc" ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Quizzes List */}
      <div className="space-y-4">
        {currentQuizzes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              لا توجد نتائج
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              لا توجد امتحانات تطابق معايير البحث المحددة
            </p>
          </div>
        ) : (
          currentQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors"
            >
              <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {quiz.title}
                  </h3>
                  {quiz.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
                      {quiz.description.startsWith('{') ? (() => {
                        try {
                          const parsed = JSON.parse(quiz.description);
                          return parsed.description || quiz.description;
                        } catch (e) {
                          return quiz.description;
                        }
                      })() : quiz.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {quiz.subject && (
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                        {quiz.subject}
                      </span>
                    )}
                    {quiz.department && (
                      <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
                        {quiz.department}
                      </span>
                    )}
                    {quiz.year && (
                      <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">
                        {quiz.year}
                      </span>
                    )}
                    <span>
                      المصدر: {quiz.source_type === 'manual' ? 'يدوي' : 'ذكاء اصطناعي'}
                    </span>
                    {quiz.avg_rating > 0 && (
                      <span className="flex items-center gap-1 text-brand-orange">
                        <Star className="w-3 h-3 fill-brand-orange" />
                        {quiz.avg_rating} ({quiz.reviews_count})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(quiz.status === "pending" || !quiz.status) && (
                    <>
                      <button
                        onClick={() => onUpdateStatus(quiz.id, "approved")}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                      >
                        اعتماد
                      </button>
                      <button
                        onClick={() => onUpdateStatus(quiz.id, "rejected")}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                      >
                        رفض
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onDeleteQuiz(quiz.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  تم الإنشاء:{" "}
                  {new Date(quiz.created_at).toLocaleDateString("ar-SA")}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    quiz.status === "approved"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : quiz.status === "rejected"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {quiz.status === "approved"
                    ? "معتمد"
                    : quiz.status === "rejected"
                    ? "مرفوض"
                    : "قيد المراجعة"}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                عرض {startIndex + 1}-
                {Math.min(endIndex, filteredQuizzes.length)} من{" "}
                {filteredQuizzes.length} امتحان
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
