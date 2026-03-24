import React from "react";
import { AcademicLevelOption } from "@/hooks/useAcademicOptions";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

type NewsDraftTargeting = {
  year: string | null;
  department: string | null;
  subject: string | null;
};

type NamedOption = { id: string; name: string; is_active?: boolean };

interface NewsTargetFiltersProps {
  newNews: NewsDraftTargeting;
  onSetNewNews: (news: NewsDraftTargeting) => void;
  semester: number;
  setSemester: (sem: number) => void;
  levels: AcademicLevelOption[];
  availableDepartments: NamedOption[];
  subjects: NamedOption[];
  subjectsLoading: boolean;
  t: TranslationFn;
}

export function NewsTargetFilters({
  newNews,
  onSetNewNews,
  semester,
  setSemester,
  levels,
  availableDepartments,
  subjects,
  subjectsLoading,
  t,
}: NewsTargetFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <div>
        <label 
          htmlFor="news-target-level"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {t("newsLevel")} ({t("newsOptional")})
        </label>
        <select
          id="news-target-level"
          name="year"
          value={newNews.year || ""}
          onChange={(e) =>
            onSetNewNews({
              ...newNews,
              year: e.target.value || null,
              department: null,
              subject: null,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">{t("newsLevelAll")}</option>
          {levels.map((level) => (
            <option key={level.id} value={level.name}>
              {level.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label 
          htmlFor="news-target-semester"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {t("newsSemesterLabel")}
        </label>
        <select
          id="news-target-semester"
          name="semester"
          value={semester}
          onChange={(e) => {
            const next = Number(e.target.value);
            setSemester(next);
            onSetNewNews({
              ...newNews,
              department: null,
              subject: null,
            });
          }}
          disabled={!newNews.year}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60"
        >
          <option value={1}>{t("newsSemester1")}</option>
          <option value={2}>{t("newsSemester2")}</option>
        </select>
      </div>

      <div>
        <label 
          htmlFor="news-target-department"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {t("newsDepartment")} ({t("newsOptional")})
        </label>
        <select
          id="news-target-department"
          name="department"
          value={newNews.department || ""}
          onChange={(e) =>
            onSetNewNews({
              ...newNews,
              department: e.target.value || null,
              subject: null,
            })
          }
          disabled={!newNews.year || availableDepartments.length === 0}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">{t("newsDepartmentAll")}</option>
          {availableDepartments.map((dept) => (
            <option key={dept.id} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label 
          htmlFor="news-target-subject"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {t("newsSubject")} ({t("newsOptional")})
        </label>
        <select
          id="news-target-subject"
          name="subject"
          value={newNews.subject || ""}
          onChange={(e) =>
            onSetNewNews({
              ...newNews,
              subject: e.target.value || null,
            })
          }
          disabled={subjectsLoading}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60"
        >
          <option value="">
            {subjectsLoading ? t("newsSubjectLoading") : t("newsSubjectAll")}
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
