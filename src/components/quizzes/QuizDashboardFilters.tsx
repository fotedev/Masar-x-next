import React from "react";

interface QuizDashboardFiltersProps {
  filters: {
    search: string;
    subject: string;
    department: string;
    year: string;
    semester: string;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      search: string;
      subject: string;
      department: string;
      year: string;
      semester: string;
    }>
  >;
  filterOptions: {
    subjects: string[];
    departments: string[];
    years: string[];
    semesters: string[];
  };
  t: (key: string) => string;
}

export function QuizDashboardFilters({
  filters,
  setFilters,
  filterOptions,
  t,
}: QuizDashboardFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          value={filters.search}
          onChange={(e) =>
            setFilters((p) => ({ ...p, search: e.target.value }))
          }
          placeholder={t("searchPlaceholder")}
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white"
        />

        <select
          value={filters.year}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              year: e.target.value,
              semester: "",
              department: "",
              subject: "",
            }))
          }
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white"
        >
          <option value="">{t("allLevels")}</option>
          {filterOptions.years.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={filters.semester}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              semester: e.target.value,
              department: "",
              subject: "",
            }))
          }
          disabled={!filters.year}
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white disabled:opacity-50"
        >
          <option value="">{t("allSemesters")}</option>
          <option value="1">{t("semester1")}</option>
          <option value="2">{t("semester2")}</option>
        </select>

        <select
          value={filters.department}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              department: e.target.value,
              subject: "",
            }))
          }
          disabled={!filters.year}
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white disabled:opacity-50"
        >
          <option value="">{t("allDepartments")}</option>
          {filterOptions.departments.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={filters.subject}
          onChange={(e) =>
            setFilters((p) => ({ ...p, subject: e.target.value }))
          }
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white"
        >
          <option value="">{t("allSubjects")}</option>
          {filterOptions.subjects.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {(filters.search ||
        filters.subject ||
        filters.department ||
        filters.year ||
        filters.semester) && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() =>
              setFilters({
                search: "",
                subject: "",
                department: "",
                year: "",
                semester: "",
              })
            }
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
          >
            {t("clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
