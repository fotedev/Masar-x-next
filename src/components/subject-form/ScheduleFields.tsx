import React from "react";

interface ScheduleFieldsProps {
  formData: {
    schedule: string;
    location: string;
    description: string;
  };
  setFormData: (data: any) => void;
}

export function ScheduleFields({ formData, setFormData }: ScheduleFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          الجدول الدراسي
        </label>
        <input
          type="text"
          value={formData.schedule || ""}
          onChange={(e) =>
            setFormData((prev: any) => ({ ...prev, schedule: e.target.value }))
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: الاثنين 08:00 ص - 10:00 ص"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          موقع المحاضرة
        </label>
        <input
          type="text"
          value={formData.location || ""}
          onChange={(e) =>
            setFormData((prev: any) => ({ ...prev, location: e.target.value }))
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="مثال: مدرج 3 - الدور الثاني"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
          نبذة عن المادة
        </label>
        <textarea
          value={formData.description || ""}
          onChange={(e) =>
            setFormData((prev: any) => ({ ...prev, description: e.target.value }))
          }
          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
          placeholder="اكتب وصفاً موجزاً لأهداف المادة ومواضيعها الأساسية..."
        />
      </div>
    </>
  );
}
