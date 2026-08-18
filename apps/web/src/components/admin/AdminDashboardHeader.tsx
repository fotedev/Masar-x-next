import { type Dispatch, type SetStateAction, type FC } from "react";

import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AcademicLevelOption, DepartmentOption } from "../../hooks/useAcademicOptions";
import { Subject } from "../../types/database";

interface AdminDashboardHeaderProps {
  globalFilters: {
    subject: string;
    department: string;
    year: string;
  };
  setGlobalFilters: Dispatch<SetStateAction<{
    subject: string;
    department: string;
    year: string;
  }>>;
  levels: AcademicLevelOption[];
  availableDepartments: DepartmentOption[];
  subjects: Subject[];
  onClearFilters: () => void;
}

export const AdminDashboardHeader: FC<AdminDashboardHeaderProps> = ({
  globalFilters,
  setGlobalFilters,
  levels,
  availableDepartments,
  subjects,
  onClearFilters,
}) => {
  const t = useTranslations("adminDashboard");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
            <Filter className="w-4 h-4" />
            <span>{t("globalFilter")}</span>
          </div>

          <select
            id="admin-filter-year"
            name="year"
            value={globalFilters.year}
            onChange={(e) =>
              setGlobalFilters((prev) => ({
                ...prev,
                year: e.target.value,
                department: "",
              }))
            }
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t("allLevels")}</option>
            {levels.map((level) => (
              <option key={level.id} value={level.name}>
                {level.name}
              </option>
            ))}
          </select>

          <select
            id="admin-filter-department"
            name="department"
            value={globalFilters.department}
            onChange={(e) =>
              setGlobalFilters((prev) => ({
                ...prev,
                department: e.target.value,
              }))
            }
            disabled={!globalFilters.year || availableDepartments.length === 0}
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t("allDepartments")}</option>
            {availableDepartments.map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>

          <select
            id="admin-filter-subject"
            name="subject"
            value={globalFilters.subject}
            onChange={(e) =>
              setGlobalFilters((prev) => ({
                ...prev,
                subject: e.target.value,
              }))
            }
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t("allSubjects")}</option>
            {[...new Set(subjects.map((s) => s.name))]
              .sort()
              .map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
          </select>

          {(globalFilters.subject || globalFilters.department || globalFilters.year) && (
            <button
              onClick={onClearFilters}
              className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
              title={t("clearFilters")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
