import React from "react";
import { Search } from "lucide-react";

import { useTranslations } from "next-intl";

interface AppealsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: "all" | "pending" | "reviewed" | "closed";
  setStatusFilter: (value: "all" | "pending" | "reviewed" | "closed") => void;
  filteredCount: number;
  totalCount: number;
}

export function AppealsFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  filteredCount,
  totalCount,
}: AppealsFiltersProps) {
  const t = useTranslations("appeals.filters");
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("title")} ({filteredCount} {t("of")} {totalCount})
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <label htmlFor="appeal-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="appeal-search"
                name="appealSearch"
                type="text"
                dir="auto"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200 placeholder:text-start"
              />
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label htmlFor="status-filter" className="sr-only">
              {t("statusLabel")}
            </label>
            <select
              id="status-filter"
              name="statusFilter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "pending" | "reviewed" | "closed",
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="all">{t("statusAll")}</option>
              <option value="pending">{t("statusPending")}</option>
              <option value="reviewed">{t("statusReviewed")}</option>
              <option value="closed">{t("statusClosed")}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
