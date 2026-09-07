import { useState, useMemo, useEffect } from "react";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { Appeal } from "../types/database";
import { useAuth } from "../contexts/AuthContext";
import { useTranslations } from "next-intl";
import { AppealsFilters } from "./appeals/AppealsFilters";
import { AppealCard } from "./appeals/AppealCard";

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
  const t = useTranslations("appeals");
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
            {t("manageTitle")}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <Flag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t("noAppeals")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t("noAppealsDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AppealsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filteredCount={filteredAppeals.length}
        totalCount={appeals.length}
      />

      {/* Appeals List */}
      <div className="space-y-4">
        {currentAppeals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Flag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t("noResults")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("noResultsDesc")}
            </p>
          </div>
        ) : (
          currentAppeals.map((appeal) => (
            <AppealCard
              key={appeal.id}
              appeal={appeal}
              isAdmin={isAdmin}
              onAccept={onAcceptAppeal}
              onReject={onRejectAppeal}
              onDelete={onDeleteAppeal}
            />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t("paginationRange", {
                  start: startIndex + 1,
                  end: Math.min(endIndex, filteredAppeals.length),
                  total: filteredAppeals.length,
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
