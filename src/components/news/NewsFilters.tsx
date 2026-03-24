import React from "react";
import { Search } from "lucide-react";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface NewsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: "all" | "active" | "inactive";
  setStatusFilter: (value: "all" | "active" | "inactive") => void;
  t: TranslationFn;
}

export function NewsFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  t,
}: NewsFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
      <div className="flex flex-col sm:flex-row gap-4">
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
              dir="auto"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200 placeholder:text-start"
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="news-tab-status-filter" className="sr-only">
            {t("allStatuses")}
          </label>
          <select
            id="news-tab-status-filter"
            name="newsTabStatusFilter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="active">{t("active")}</option>
            <option value="inactive">{t("inactive")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
