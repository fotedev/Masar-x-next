import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Newspaper,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash,
} from "lucide-react";
import { News } from "../types/database";
import { useAuth } from "../contexts/AuthContext";

interface NewsTabProps {
  news: News[];
  onToggleStatus: (id: string, isActive: boolean) => void;
  onSetShowAddNews: (show: boolean) => void;
  onDeleteNews: (id: string) => void;
}

export function NewsTab({
  news,
  onToggleStatus,
  onSetShowAddNews,
  onDeleteNews,
}: NewsTabProps) {
  const t = useTranslations("news");
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered news
  const filteredNews = useMemo(() => {
    let filtered = news;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.type.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) =>
        statusFilter === "active" ? item.is_active : !item.is_active,
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return filtered;
  }, [news, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNews = filteredNews.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);
  if (news.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("manageNews")}
          </h2>
          <button
            onClick={() => onSetShowAddNews(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {t("addNewsModal")}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <Newspaper className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t("noNews")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t("noNewsDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("manageNewsStats", {
            filtered: filteredNews.length,
            total: news.length,
          })}
        </h2>
        <button
          onClick={() => onSetShowAddNews(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {t("addNewsModal")}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <label htmlFor="news-tab-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="news-tab-search"
                name="newsTabSearch"
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <label htmlFor="news-tab-status-filter" className="sr-only">
              {t("allStatuses")}
            </label>
            <select
              id="news-tab-status-filter"
              name="newsTabStatusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="all">{t("allStatuses")}</option>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* News List */}
      <div className="space-y-4">
        {currentNews.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Newspaper className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t("noResults")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("noResultsDescription")}
            </p>
          </div>
        ) : (
          currentNews.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors"
            >
              <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_active
                          ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {item.is_active ? t("active") : t("inactive")}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {item.content.length > 200
                      ? `${item.content.substring(0, 200)}...`
                      : item.content}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {t("type")}: {item.type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
                  <button
                    onClick={() => onToggleStatus(item.id, !item.is_active)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      item.is_active
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {item.is_active ? t("deactivate") : t("activate")}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteNews(item.id)}
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash className="w-4 h-4 inline-block mr-1" />{" "}
                      {t("delete")}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t("publishedAt")}:{" "}
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : "---"}
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                عرض {startIndex + 1}-{Math.min(endIndex, filteredNews.length)}{" "}
                من {filteredNews.length} خبر
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
