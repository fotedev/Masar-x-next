import React from "react";

interface BasicExamInfoProps {
  examFormData: {
    title: string;
    durationMinutes: string;
    department: string;
    year: string;
  };
  setExamFormData: (updater: (prev: any) => any) => void;
  levels: any[];
  availableExamDepartments: any[];
  academicOptionsLoading: boolean;
  tSubjectPage: (key: string) => string;
}

export function BasicExamInfo({
  examFormData,
  setExamFormData,
  levels,
  availableExamDepartments,
  academicOptionsLoading,
  tSubjectPage,
}: BasicExamInfoProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            {tSubjectPage("exam.titleLabel")}
          </label>
          <input
            value={examFormData.title}
            onChange={(e) =>
              setExamFormData((p) => ({ ...p, title: e.target.value }))
            }
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            {tSubjectPage("exam.durationMinutesLabel")}
          </label>
          <input
            type="number"
            value={examFormData.durationMinutes}
            onChange={(e) =>
              setExamFormData((p) => ({
                ...p,
                durationMinutes: e.target.value,
              }))
            }
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            {tSubjectPage("exam.departmentLabel")}
          </label>
          <select
            value={examFormData.department}
            onChange={(e) =>
              setExamFormData((p) => ({
                ...p,
                department: e.target.value,
              }))
            }
            disabled={
              academicOptionsLoading ||
              !examFormData.year ||
              availableExamDepartments.length === 0
            }
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold text-gray-900 dark:text-white disabled:opacity-50"
          >
            <option value="" disabled>
              {tSubjectPage("exam.departmentPlaceholder")}
            </option>
            {availableExamDepartments.map((dep) => (
              <option key={dep.id} value={dep.name}>
                {dep.name} {!dep.is_active && tSubjectPage("inactive")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-2">
            {tSubjectPage("year")}
          </label>
          <select
            value={examFormData.year}
            onChange={(e) =>
              setExamFormData((p) => ({
                ...p,
                year: e.target.value,
                department: "",
              }))
            }
            disabled={academicOptionsLoading || levels.length === 0}
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold text-gray-900 dark:text-white disabled:opacity-50"
          >
            <option value="" disabled>
              {tSubjectPage("exam.yearPlaceholder")}
            </option>
            {levels.map((lvl) => (
              <option key={lvl.id} value={lvl.name}>
                {lvl.name} {!lvl.is_active && tSubjectPage("inactive")}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
