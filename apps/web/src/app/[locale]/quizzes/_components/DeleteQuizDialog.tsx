import { Trash2 } from "lucide-react";

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface DeleteQuizDialogProps {
  t: Translator;
  isOpen: boolean;
  isDeleting: boolean;
  quizTitle: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteQuizDialog({
  t,
  isOpen,
  isDeleting,
  quizTitle,
  onConfirm,
  onCancel,
}: DeleteQuizDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("confirmDeleteTitle") || "تأكيد حذف الاختبار"}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (isDeleting) return;
        onCancel();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("confirmDeleteTitle") || "حذف الاختبار؟"}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {quizTitle
                  ? t("confirmDeleteMessageWithTitle", { title: quizTitle }) ||
                    `سيتم حذف "${quizTitle}" نهائيًا ولا يمكن التراجع عن هذا الإجراء.`
                  : t("confirmDeleteMessage") ||
                    "سيتم حذف الاختبار نهائيًا ولا يمكن التراجع عن هذا الإجراء."}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (isDeleting) return;
              onCancel();
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold"
            disabled={isDeleting}
          >
            {t("cancel") || "إلغاء"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-bold disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isDeleting}
          >
            {isDeleting ? t("deleting") || "جارٍ الحذف..." : t("delete") || "حذف"}
          </button>
        </div>
      </div>
    </div>
  );
}
