import { type Dispatch, type SetStateAction } from "react";


type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

type BasicInfoShape = {
  name: string;
  professor: string;
  professor_gender: "male" | "female";
};

interface BasicInfoFieldsProps<TFormData extends BasicInfoShape> {
  formData: TFormData;
  setFormData: Dispatch<SetStateAction<TFormData>>;
  t: TranslationFn;
}

export function BasicInfoFields<TFormData extends BasicInfoShape>({
  formData,
  setFormData,
  t,
}: BasicInfoFieldsProps<TFormData>) {
  return (
    <>
      <div>
        <label 
          htmlFor="subject-name"
          className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
        >
          اسم المادة
        </label>
        <input
          id="subject-name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData(
              (prev) => ({ ...prev, name: e.target.value }) as TFormData,
            )
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus-visible:ring-2 focus-visible:ring-blue-500 transition-[border-color,box-shadow,background-color] outline-none"
          placeholder="مثال: رياضيات 2"
        />
      </div>

      <div>
        <label 
          htmlFor="subject-professor"
          className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
        >
          اسم المحاضر
        </label>
        <input
          id="subject-professor"
          name="professor"
          type="text"
          value={formData.professor || ""}
          onChange={(e) =>
            setFormData(
              (prev) => ({ ...prev, professor: e.target.value }) as TFormData,
            )
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus-visible:ring-2 focus-visible:ring-blue-500 transition-[border-color,box-shadow,background-color] outline-none"
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
              id="professor-gender-male"
              type="radio"
              name="professor_gender"
              value="male"
              checked={formData.professor_gender === "male"}
              onChange={() =>
                setFormData(
                  (prev) =>
                    ({ ...prev, professor_gender: "male" }) as TFormData,
                )
              }
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("male")}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id="professor-gender-female"
              type="radio"
              name="professor_gender"
              value="female"
              checked={formData.professor_gender === "female"}
              onChange={() =>
                setFormData(
                  (prev) =>
                    ({ ...prev, professor_gender: "female" }) as TFormData,
                )
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
