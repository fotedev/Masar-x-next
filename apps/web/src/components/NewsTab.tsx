import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { News } from "../types/database";
import { useAuth } from "../contexts/AuthContext";
import { NewsFilters } from "./news/NewsFilters";
import { NewsCard } from "./news/NewsCard";

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
    let filtered = [...news];

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

      <NewsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        t={t}
      />

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
            <NewsCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onToggleStatus={onToggleStatus}
              onDelete={onDeleteNews}
              t={t}
            />
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
