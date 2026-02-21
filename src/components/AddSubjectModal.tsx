import { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { Database } from "../types/database";
import { useAcademicOptions } from "../hooks/useAcademicOptions";

type SubjectInsert = Database["public"]["Tables"]["subjects"]["Insert"];

interface AddSubjectModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (subject: SubjectInsert) => Promise<void>;
  editingSubject?: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

import { toast } from "sonner";

export function AddSubjectModal({
  show,
  onClose,
  onSave,
  editingSubject,
}: AddSubjectModalProps) {
  const { levels } = useAcademicOptions({ includeInactive: true });
  const [formData, setFormData] = useState<SubjectInsert>({
    name: "",
    professor: "",
    description: "",
    schedule: "",
    location: "",
    level: 1,
    semester: 1,
    is_academic: true,
    show_on_home: true,
    status: "pending",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSubject) {
      setFormData({
        name: editingSubject.name,
        professor: editingSubject.professor || "",
        description: editingSubject.description || "",
        schedule: editingSubject.schedule || "",
        location: editingSubject.location || "",
        level: editingSubject.level || 1,
        semester: editingSubject.semester || 1,
        is_academic: editingSubject.is_academic ?? true,
        show_on_home: editingSubject.show_on_home,
        status: editingSubject.status,
      });
    } else {
      setFormData({
        name: "",
        professor: "",
        description: "",
        schedule: "",
        location: "",
        level: 1,
        semester: 1,
        is_academic: true,
        show_on_home: true,
        status: "pending",
      });
    }
  }, [editingSubject, show]);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError("يرجى إدخال اسم المادة");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(formData);
      onClose();
      toast.success("تم حفظ المادة بنجاح", {
        description: editingSubject
          ? "تم تحديث بيانات المادة."
          : "تمت إضافة المادة الجديدة إلى النظام.",
      });
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء حفظ المادة");
      toast.error("خطأ في الحفظ", {
        description:
          err.message || "حدث خطأ أثناء حفظ المادة، يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {editingSubject ? "تعديل مادة" : "إضافة مادة جديدة"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
              اسم المادة
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
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
                setFormData({ ...formData, professor: e.target.value })
              }
              className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="مثال: د. أحمد"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
              الجدول الدراسي
            </label>
            <input
              type="text"
              value={formData.schedule || ""}
              onChange={(e) =>
                setFormData({ ...formData, schedule: e.target.value })
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
                setFormData({ ...formData, location: e.target.value })
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
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
              placeholder="اكتب وصفاً موجزاً لأهداف المادة ومواضيعها الأساسية..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                المستوى
              </label>
              <select
                value={formData.level || 1}
                onChange={(e) =>
                  setFormData({ ...formData, level: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {levels.map((lvl, i) => (
                  <option
                    key={lvl.id}
                    value={
                      typeof lvl.level_number === "number"
                        ? lvl.level_number
                        : i + 1
                    }
                  >
                    المستوى{" "}
                    {typeof lvl.level_number === "number"
                      ? lvl.level_number
                      : i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                الترم
              </label>
              <select
                value={formData.semester || 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    semester: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value={1}>الترم الأول</option>
                <option value={2}>الترم الثاني</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="is_academic"
              checked={formData.is_academic ?? true}
              onChange={(e) =>
                setFormData({ ...formData, is_academic: e.target.checked })
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
                setFormData({ ...formData, show_on_home: e.target.checked })
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

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? "جاري الحفظ..." : "حفظ المادة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
