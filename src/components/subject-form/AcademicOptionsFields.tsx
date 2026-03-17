import React from "react";
import { AcademicLevelOption } from "@/hooks/useAcademicOptions";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

type AcademicOptionsShape = {
  level: number;
  semester: number;
  is_academic: boolean;
  show_on_home: boolean;
};

interface AcademicOptionsFieldsProps<TFormData extends AcademicOptionsShape> {
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  levels: AcademicLevelOption[];
  optionsLoading: boolean;
  t: TranslationFn;
}

export function AcademicOptionsFields<TFormData extends AcademicOptionsShape>({
  formData,
  setFormData,
  levels,
  optionsLoading,
  t,
}: AcademicOptionsFieldsProps<TFormData>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
            المستوى
          </label>
          <select
            value={formData.level || 1}
            onChange={(e) =>
              setFormData(
                (prev) =>
                  ({
                    ...prev,
                    level: parseInt(e.target.value),
                  }) as TFormData,
              )
            }
            disabled={optionsLoading}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
          >
            {optionsLoading ? (
              <option>{t("optionsLoading")}</option>
            ) : (
              levels.map((lvl, i) => (
                <option
                  key={lvl.id}
                  value={
                    typeof lvl.level_number === "number"
                      ? lvl.level_number
                      : i + 1
                  }
                >
                  {t("levelOption", {
                    level:
                      typeof lvl.level_number === "number"
                        ? lvl.level_number
                        : i + 1,
                  })}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
            الترم
          </label>
          <select
            value={formData.semester || 1}
            onChange={(e) =>
              setFormData(
                (prev) =>
                  ({
                    ...prev,
                    semester: parseInt(e.target.value),
                  }) as TFormData,
              )
            }
            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value={1}>{t("semester1")}</option>
            <option value={2}>{t("semester2")}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          id="is_academic"
          checked={formData.is_academic ?? true}
          onChange={(e) =>
            setFormData(
              (prev) =>
                ({
                  ...prev,
                  is_academic: e.target.checked,
                }) as TFormData,
            )
          }
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="is_academic"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          مادة أكاديمية (مرتبطة بمستوى وترم)
        </label>
      </div>

      <div className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          id="show_on_home"
          checked={formData.show_on_home ?? true}
          onChange={(e) =>
            setFormData(
              (prev) =>
                ({
                  ...prev,
                  show_on_home: e.target.checked,
                }) as TFormData,
            )
          }
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="show_on_home"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          عرض في الصفحة الرئيسية
        </label>
      </div>
    </>
  );
}
