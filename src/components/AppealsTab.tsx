import { useState, useMemo, useEffect } from "react";
import {
  Flag,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trash,
} from "lucide-react";
import { Appeal } from "../types/database";
import { useAuth } from "../contexts/AuthContext";

interface AppealsTabProps {
  appeals: Appeal[];
  onAcceptAppeal: (id: string, userId: string, contentTitle: string) => void;
  onRejectAppeal: (id: string, userId: string, contentTitle: string) => void;
  onDeleteAppeal: (id: string) => void;
}

export function AppealsTab({
  appeals,
  onAcceptAppeal,
  onRejectAppeal,
  onDeleteAppeal,
}: AppealsTabProps) {
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "reviewed" | "closed"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered appeals
  const filteredAppeals = useMemo(() => {
    let filtered = appeals;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (appeal) =>
          appeal.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          appeal.content_type
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (appeal.created_by &&
            appeal.created_by
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          appeal.content_id?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((appeal) => appeal.status === statusFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return filtered;
  }, [appeals, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAppeals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAppeals = filteredAppeals.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);
  if (appeals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            إدارة الطعون
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <Flag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد طعون
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            لم يتم تقديم أي طعون حتى الآن
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          إدارة الطعون والبلاغات ({filteredAppeals.length} من {appeals.length})
        </h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <label htmlFor="appeal-search" className="sr-only">
                البحث في الطعون
              </label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="appeal-search"
                name="appealSearch"
                type="text"
                placeholder="البحث في سبب الطعن، نوع المحتوى، أو اسم المستخدم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <label htmlFor="status-filter" className="sr-only">
              تصفية حسب الحالة
            </label>
            <select
              id="status-filter"
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد المراجعة</option>
              <option value="reviewed">تمت المراجعة</option>
              <option value="closed">مغلق</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appeals List */}
      <div className="space-y-4">
        {currentAppeals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Flag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              لا توجد نتائج
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              لا توجد طعون تطابق معايير البحث المحددة
            </p>
          </div>
        ) : (
          currentAppeals.map((appeal) => (
            <div
              key={appeal.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors"
            >
              <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      طعن على:{" "}
                      {appeal.content_type === "summary" ? "ملخص" : "خبر"}
                      {appeal.content_title && ` - "${appeal.content_title}"`}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appeal.status === "pending"
                          ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                          : appeal.status === "accepted"
                            ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300"
                      }`}
                    >
                      {appeal.status === "pending"
                        ? "قيد المراجعة"
                        : appeal.status === "accepted"
                          ? "مقبول"
                          : "مرفوض"}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {appeal.reason}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>بواسطة: {appeal.created_by || "مستخدم مجهول"}</span>
                    <span>معرف المحتوى: {appeal.content_id}</span>
                  </div>
                  {appeal.reviewed_by && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                      تمت المراجعة بواسطة: {appeal.reviewed_by}
                    </span>
                  )}
                </div>
                {isAdmin && appeal.status === "pending" && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
                    <button
                      onClick={() =>
                        onAcceptAppeal(
                          appeal.id,
                          appeal.created_by || "",
                          appeal.content_title || "",
                        )
                      }
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 inline-block mr-1" /> قبول
                    </button>
                    <button
                      onClick={() =>
                        onRejectAppeal(
                          appeal.id,
                          appeal.created_by || "",
                          appeal.content_title || "",
                        )
                      }
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
                    >
                      <X className="w-4 h-4 inline-block mr-1" /> رفض
                    </button>
                  </div>
                )}
                {isAdmin && appeal.status !== "pending" && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
                    <button
                      onClick={() => onDeleteAppeal(appeal.id)}
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      <Trash className="w-4 h-4 inline-block mr-1" /> حذف
                    </button>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                تم التقديم:{" "}
                {appeal.created_at
                  ? new Date(appeal.created_at).toLocaleDateString("ar-SA")
                  : "غير معروف"}
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
                {Math.min(endIndex, filteredAppeals.length)} من{" "}
                {filteredAppeals.length} طعن
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
                            ? "bg-orange-600 text-white"
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
