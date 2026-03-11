import { useState, useMemo, useEffect } from "react";
import { Eye, Trash2 } from "lucide-react";
import { SummaryWithRatings } from "../types/database";
import { useAuth } from "../contexts/AuthContext";
import { useTranslations } from "next-intl";
import { SummaryFilters } from "./summaries/SummaryFilters";
import { SummaryCard } from "./summaries/SummaryCard";
import { Pagination } from "./summaries/Pagination";

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
  const t = useTranslations("summaries");
  const tCommon = useTranslations("common");
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
      let aValue: string | number;
      let bValue: string | number;

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
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  if (summaries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
          <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t("noSummaries")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t("noSummariesDesc")}
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
          {t("manageTitle")} ({filteredSummaries.length} {tCommon("of")}{" "}
          {summaries.length})
        </h2>
        <button
          onClick={onClearAllSummaries}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-500 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t("deleteAll")}</span>
        </button>
      </div>

      <SummaryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Summaries List */}
      <div className="space-y-4">
        {currentSummaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center transition-colors">
            <Eye className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t("noResults")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("noResultsDesc")}
            </p>
          </div>
        ) : (
          currentSummaries.map((summary) => (
            <SummaryCard
              key={summary.id}
              summary={summary}
              user={user}
              isAdmin={isAdmin}
              onEdit={onEditSummary}
              onUpdateStatus={onUpdateStatus}
              onDelete={onDeleteSummary}
            />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={filteredSummaries.length}
          />
        )}
      </div>
    </div>
  );
}
