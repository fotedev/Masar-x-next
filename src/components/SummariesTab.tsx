import { useState, useMemo } from "react";
import {
  Eye,
  Trash2,
  Search,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  Edit,
  Star,
} from "lucide-react";
import { SummaryWithRatings } from "../types/database";
import { useAuth } from "../contexts/AuthContext";

interface SummariesTabProps {
  summaries: SummaryWithRatings[];
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
  onDeleteSummary: (id: string) => void;
  onEditSummary?: (summary: SummaryWithRatings) => void;
  onClearAllSummaries: () => void;
}

export function SummariesTab({
  summaries,
  onUpdateStatus,
  onDeleteSummary,
  onEditSummary,
  onClearAllSummaries,
}: SummariesTabProps) {
  const { user, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "subject">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered and sorted summaries
  const filteredSummaries = useMemo(() => {
    let filtered = summaries;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (summary) =>
          summary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          summary.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          summary.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (summary.contributor_name &&
            summary.contributor_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase())),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((summary) => summary.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "subject":
          aValue = a.subject.toLowerCase();
          bValue = b.subject.toLowerCase();
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
  }, [summaries, searchTerm, statusFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredSummaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSummaries = filteredSummaries.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);
  if (summaries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد ملخصات
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            لا توجد ملخصات في هذه الفئة حالياً
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with title and clear button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          إدارة الملخصات ({filteredSummaries.length} من {summaries.length})
        </h2>
        <button
          onClick={onClearAllSummaries}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-500 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>حذف جميع الملخصات</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <label htmlFor="summaries-search" className="sr-only">
                البحث في الملخصات
              </label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="summaries-search"
                name="summariesSearch"
                type="text"
                placeholder="البحث في العنوان، المحتوى، المادة، أو اسم المساهم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full lg:w-48">
            <label htmlFor="summaries-status-filter" className="sr-only">
              تصفية حسب الحالة
            </label>
            <select
              id="summaries-status-filter"
              name="summariesStatusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد المراجعة</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>

          {/* Sort */}
          <div className="w-full lg:w-48">
            <label htmlFor="summaries-sort-by" className="sr-only">
              الفرز حسب
            </label>
            <select
              id="summaries-sort-by"
              name="summariesSortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="date">ترتيب بالتاريخ</option>
              <option value="title">ترتيب بالعنوان</option>
              <option value="subject">ترتيب بالمادة</option>
            </select>
          </div>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={sortOrder === "asc" ? "ترتيب تصاعدي" : "ترتيب تنازلي"}
          >
            {sortOrder === "asc" ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      {/* Summaries List */}
      <div className="space-y-4">
        {currentSummaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              لا توجد نتائج
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              لا توجد ملخصات تطابق معايير البحث المحددة
            </p>
          </div>
        ) : (
          currentSummaries.map((summary) => {
            const canEdit = user && (isAdmin || summary.user_id === user.id);
            const canDelete = user && (isAdmin || summary.user_id === user.id);

            return (
              <div
                key={summary.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors"
              >
                <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        ملخص للموضوع: {summary.title}
                      </h3>
                      {canEdit && onEditSummary && (
                        <button
                          onClick={() => onEditSummary(summary)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded"
                          title="تعديل الملخص"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          summary.status === "pending"
                            ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                            : summary.status === "approved"
                              ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                              : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300"
                        }`}
                      >
                        {summary.status === "pending"
                          ? "قيد المراجعة"
                          : summary.status === "approved"
                            ? "معتمد"
                            : "مرفوض"}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {summary.content.length > 200
                        ? `${summary.content.substring(0, 200)}...`
                        : summary.content}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        بواسطة: {summary.contributor_name || "مستخدم مجهول"}
                      </span>
                      <span>المادة: {summary.subject}</span>
                      {summary.avg_rating > 0 && (
                        <span className="flex items-center gap-1 text-brand-orange">
                          <Star className="w-3 h-3 fill-brand-orange" />
                          {summary.avg_rating} ({summary.reviews_count})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => onUpdateStatus(summary.id, "approved")}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        >
                          اعتماد
                        </button>
                        <button
                          onClick={() => onUpdateStatus(summary.id, "rejected")}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                        >
                          رفض
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDeleteSummary(summary.id)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  تم الإرسال:{" "}
                  {new Date(summary.created_at).toLocaleDateString("ar-SA")}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                عرض {startIndex + 1}-
                {Math.min(endIndex, filteredSummaries.length)} من{" "}
                {filteredSummaries.length} ملخص
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

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

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
