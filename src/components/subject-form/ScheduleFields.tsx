import React from "react";

type ScheduleShape = {
  schedule: string;
  location: string;
  description: string;
};

interface ScheduleFieldsProps<TFormData extends ScheduleShape> {
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
}

export function ScheduleFields<TFormData extends ScheduleShape>({
  formData,
  setFormData,
}: ScheduleFieldsProps<TFormData>) {
  return (
    <>
      <div>
        <label 
          htmlFor="subject-schedule"
          className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
        >
          الجدول الدراسي
        </label>
        <input
          id="subject-schedule"
          name="schedule"
          type="text"
          value={formData.schedule || ""}
          onChange={(e) =>
            setFormData(
              (prev) => ({ ...prev, schedule: e.target.value }) as TFormData,
            )
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: الاثنين 08:00 ص - 10:00 ص"
        />
      </div>

      <div>
        <label 
          htmlFor="subject-location"
          className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
        >
          موقع المحاضرة
        </label>
        <input
          id="subject-location"
          name="location"
          type="text"
          value={formData.location || ""}
          onChange={(e) =>
            setFormData(
              (prev) => ({ ...prev, location: e.target.value }) as TFormData,
            )
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: مدرج 3 - الدور الثاني"
        />
      </div>

      <div>
        <label 
          htmlFor="subject-description"
          className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
        >
          نبذة عن المادة
        </label>
        <textarea
          id="subject-description"
          name="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData(
              (prev) =>
                ({
                  ...prev,
                  description: e.target.value,
                }) as TFormData,
            )
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
          placeholder="اكتب وصفاً موجزاً لأهداف المادة ومواضيعها الأساسية..."
        />
      </div>
    </>
  );
}
