import React from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import type {
  AcademicLevelOption,
  DepartmentOption,
  QuizFormData,
  SubjectOption,
  SummaryOption,
} from "./types";

export function QuizMetaFields(props: {
  editingQuiz: { id: string } | null;
  formData: QuizFormData;
  setFormData: React.Dispatch<React.SetStateAction<QuizFormData>>;
  academicLevels: AcademicLevelOption[];
  getDepartmentsForLevelName: (level: string) => DepartmentOption[];
  filteredSubjectsForForm: SubjectOption[];
  allSubjects: SubjectOption[];
  summaries: SummaryOption[];
  onOpenImport: () => void;
}) {
  const {
    editingQuiz,
    formData,
    setFormData,
    academicLevels,
    getDepartmentsForLevelName,
    filteredSubjectsForForm,
    allSubjects,
    summaries,
    onOpenImport,
  } = props;

  const t = useTranslations("quizzes");
  const onboardingT = useTranslations("onboarding");

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {editingQuiz ? t("editQuiz") : t("newExam")}
        </h2>
        <button
          onClick={onOpenImport}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          {t("import")}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("examTitle")}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder={t("examTitlePlaceholder")}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("examDurationMinutes")}
        </label>
        <input
          type="number"
          min={1}
          value={formData.durationMinutes}
          onChange={(e) =>
            setFormData({ ...formData, durationMinutes: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder={t("durationPlaceholder")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {onboardingT("academicLevel")}{" "}
            <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.year}
            onChange={(e) =>
              setFormData({
                ...formData,
                year: e.target.value,
                department: "",
                semester: "",
                subject: "",
                summaryId: "",
              })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{onboardingT("selectLevel")}</option>
            {academicLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.name}>
                {lvl.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("selectSemester")} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.semester}
            onChange={(e) =>
              setFormData({
                ...formData,
                semester: e.target.value,
                department: "",
                subject: "",
                summaryId: "",
              })
            }
            disabled={!formData.year}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value="">{t("selectSemester")}</option>
            <option value="1">{t("semester1")}</option>
            <option value="2">{t("semester2")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {onboardingT("department")} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.department}
            onChange={(e) =>
              setFormData({
                ...formData,
                department: e.target.value,
                subject: "",
                summaryId: "",
              })
            }
            disabled={
              !formData.year ||
              !formData.semester ||
              getDepartmentsForLevelName(formData.year).length === 0
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value="">{onboardingT("selectDepartment")}</option>
            {getDepartmentsForLevelName(formData.year).map((dep) => (
              <option key={dep.id} value={dep.name}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("selectSubject")} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.subject}
            onChange={(e) =>
              setFormData({
                ...formData,
                subject: e.target.value,
                summaryId: "",
              })
            }
            disabled={
              !formData.year || !formData.semester || !formData.department
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t("selectSubject")}</option>
            {(formData.year ? filteredSubjectsForForm : allSubjects).map(
              (subject) => (
                <option key={subject.id} value={subject.name}>
                  {subject.name}
                </option>
              ),
            )}
          </select>
        </div>

        {summaries.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("linkSummary")}
            </label>
            <select
              value={formData.summaryId}
              onChange={(e) =>
                setFormData({ ...formData, summaryId: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t("selectSummary")}</option>
              {summaries.map((summary) => (
                <option key={summary.id} value={summary.id}>
                  {summary.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("examDescription")}
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          rows={3}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>
    </>
  );
}
