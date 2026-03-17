import React from "react";
import {
  AcademicLevelOption,
  DepartmentOption,
} from "@/hooks/useAcademicOptions";
import { Subject } from "@/types/database";

type SummaryFormData = {
  title: string;
  subject: string;
  year: string;
  department: string;
  content: string;
};

interface SummaryFormFieldsProps {
  formData: SummaryFormData;
  setFormData: React.Dispatch<React.SetStateAction<SummaryFormData>>;
  levels: AcademicLevelOption[];
  availableDepartments: DepartmentOption[];
  subjects: Subject[];
  semester: number;
  setSemester: (semester: number) => void;
}

export function SummaryFormFields({
  formData,
  setFormData,
  levels,
  availableDepartments,
  subjects,
  semester,
  setSemester,
}: SummaryFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          عنوان الملخص <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            المستوى الدراسي <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.year}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                year: e.target.value,
                department: "",
                subject: "",
              }))
            }
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">اختر المستوى</option>
            {levels.map((level) => (
              <option key={level.id} value={level.name}>
                {level.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            الترم <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={semester}
            onChange={(e) => {
              const next = Number(e.target.value);
              setSemester(next);
              setFormData((prev) => ({
                ...prev,
                department: "",
                subject: "",
              }));
            }}
            disabled={!formData.year}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value={1}>ترم 1</option>
            <option value={2}>ترم 2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            التخصص <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.department}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                department: e.target.value,
              }))
            }
            disabled={!formData.year || availableDepartments.length === 0}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">اختر التخصص</option>
            {availableDepartments.map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          اسم المادة <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={formData.subject}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subject: e.target.value }))
          }
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">اختر المادة</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.name}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          محتوى الملخص <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={formData.content}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={10}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </>
  );
}
