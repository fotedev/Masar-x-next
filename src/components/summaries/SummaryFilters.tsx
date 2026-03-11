import { Search, SortAsc, SortDesc } from "lucide-react";
import { useTranslations } from "next-intl";

interface SummaryFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: any) => void;
  sortBy: string;
  setSortBy: (value: any) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (value: "asc" | "desc") => void;
}

export function SummaryFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: SummaryFiltersProps) {
  const t = useTranslations("summaries.filters");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <label htmlFor="summaries-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="summaries-search"
              name="summariesSearch"
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="w-full lg:w-48">
          <label htmlFor="summaries-status-filter" className="sr-only">
            {t("statusLabel")}
          </label>
          <select
            id="summaries-status-filter"
            name="summariesStatusFilter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "pending" | "approved" | "rejected",
              )
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
          >
            <option value="all">{t("statusAll")}</option>
            <option value="pending">{t("statusPending")}</option>
            <option value="approved">{t("statusApproved")}</option>
            <option value="rejected">{t("statusRejected")}</option>
          </select>
        </div>

        {/* Sort */}
        <div className="w-full lg:w-48">
          <label htmlFor="summaries-sort-by" className="sr-only">
            {t("sortByLabel")}
          </label>
          <select
            id="summaries-sort-by"
            name="summariesSortBy"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "date" | "title" | "subject")
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
          >
            <option value="date">{t("sortByDate")}</option>
            <option value="title">{t("sortByTitle")}</option>
            <option value="subject">{t("sortBySubject")}</option>
          </select>
        </div>

        {/* Sort Order */}
        <button
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title={sortOrder === "asc" ? t("sortAsc") : t("sortDesc")}
        >
          {sortOrder === "asc" ? (
            <SortAsc className="w-4 h-4" />
          ) : (
            <SortDesc className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
