import React from "react";

interface BasicInfoFieldsProps {
  formData: {
    name: string;
    professor: string;
    professor_gender: "male" | "female";
  };
  setFormData: (data: any) => void;
  t: any;
}

export function BasicInfoFields({ formData, setFormData, t }: BasicInfoFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          اسم المادة
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData((prev: any) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: رياضيات 2"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          اسم المحاضر
        </label>
        <input
          type="text"
          value={formData.professor || ""}
          onChange={(e) =>
            setFormData((prev: any) => ({ ...prev, professor: e.target.value }))
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: د. أحمد"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          {t("professorGender")}
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="professor_gender"
              value="male"
              checked={formData.professor_gender === "male"}
              onChange={() =>
                setFormData((prev: any) => ({ ...prev, professor_gender: "male" }))
              }
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("male")}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="professor_gender"
              value="female"
              checked={formData.professor_gender === "female"}
              onChange={() =>
                setFormData((prev: any) => ({ ...prev, professor_gender: "female" }))
              }
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("female")}
            </span>
          </label>
        </div>
      </div>
    </>
  );
}
