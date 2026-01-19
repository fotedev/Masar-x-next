import { useState } from "react";
import { Flag, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { AppealInsert } from "../types/database";

interface AppealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType: "summary" | "news";
  contentTitle: string;
}

export function AppealFormModal({
  isOpen,
  onClose,
  contentId,
  contentType,
  contentTitle,
}: AppealFormModalProps) {
  const { displayName } = useAuth();
  const { notifyAdmins } = useNotifications();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appealReasons = [
    { value: "inaccurate_content", label: "محتوى غير دقيق" },
    { value: "copyright_violation", label: "انتهاك حقوق النشر" },
    { value: "inappropriate_content", label: "محتوى غير مناسب" },
    { value: "spam", label: "محتوى مزعج أو إعلاني" },
    { value: "other", label: "سبب آخر" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      console.warn("يرجى اختيار سبب الطعن");
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.warn("يجب تسجيل الدخول لإرسال طعن");
        return;
      }

      const appealData: AppealInsert = {
        content_id: contentId,
        content_type: contentType,
        reason,
        description: description.trim() || null,
        created_by: user.id,
      };

      const { error } = await supabase.from("appeals").insert(appealData);

      if (error) throw error;

      // إرسال إشعار للمدراء
      const appealReasonsMap: { [key: string]: string } = {
        inaccurate_content: "محتوى غير دقيق",
        copyright_violation: "انتهاك حقوق النشر",
        inappropriate_content: "محتوى غير مناسب",
        spam: "محتوى مزعج أو إعلاني",
        other: "سبب آخر",
      };

      notifyAdmins(
        "طعن جديد على محتوى",
        `تم إرسال طعن على ${
          contentType === "summary" ? "ملخص" : "خبر"
        } "${contentTitle}" لسبب: ${appealReasonsMap[reason] || reason}`,
        "admin_submission",
        contentId,
        contentType
      );

      console.log(
        "✅ تم إرسال الطعن بنجاح - شكراً لك على مساهمتك في تحسين المحتوى"
      );
      onClose();
      setReason("");
      setDescription("");
    } catch (error) {
      console.error("Error submitting appeal:", error);
      console.error("حدث خطأ أثناء إرسال الطعن - يرجى المحاولة مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Flag className="w-6 h-6 text-orange-500" />
              تقديم طعن
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>المحتوى:</strong> {contentTitle}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              نوع المحتوى: {contentType === "summary" ? "تلخيص" : "خبر"}
            </p>
          </div>

          {displayName && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>ملاحظة:</strong> الطعن سيُرسل باسم:{" "}
                <strong>{displayName}</strong>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                سبب الطعن *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">اختر السبب...</option>
                {appealReasons.map((appealReason) => (
                  <option key={appealReason.value} value={appealReason.value}>
                    {appealReason.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                وصف المشكلة (اختياري)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="يرجى وصف المشكلة بالتفصيل..."
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {isSubmitting ? "جاري الإرسال..." : "إرسال الطعن"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>ملاحظة:</strong> سيتم مراجعة طعنك من قبل فريق الإدارة.
              نشكرك على مساهمتك في تحسين جودة المحتوى.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
