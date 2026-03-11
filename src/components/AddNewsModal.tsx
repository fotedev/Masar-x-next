import { useTranslations } from "next-intl";
import { Database } from "../types/database";
import { useAddNewsForm } from "@/hooks/useAddNewsForm";
import { NewsFormFields } from "./news-form/NewsFormFields";
import { NewsTargetFilters } from "./news-form/NewsTargetFilters";
import { NewsMediaUploads } from "./news-form/NewsMediaUploads";

interface AddNewsModalProps {
  showAddNews: boolean;
  newNews: Database["public"]["Tables"]["news"]["Insert"];
  onSetShowAddNews: (show: boolean) => void;
  onSetNewNews: (news: Database["public"]["Tables"]["news"]["Insert"]) => void;
  onAddNews: (
    news: Database["public"]["Tables"]["news"]["Insert"],
    fileUrl: string | null,
    imageUrls: string[] | null,
    customCategory: string | null,
  ) => void;
}

export function AddNewsModal({
  showAddNews,
  newNews,
  onSetShowAddNews,
  onSetNewNews,
  onAddNews,
}: AddNewsModalProps) {
  const t = useTranslations("news");

  const {
    semester,
    setSemester,
    levels,
    subjects,
    subjectsLoading,
    availableDepartments,
    fileFile,
    setFileFile,
    imageFiles,
    setImageFiles,
    customCategory,
    setCustomCategory,
    loading,
    error,
    setError,
    handleAddNews,
  } = useAddNewsForm({
    newNews,
    onAddNews,
  });

  if (!showAddNews) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t("addNewsModal")}
          </h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <NewsFormFields
              newNews={newNews as any}
              onSetNewNews={onSetNewNews}
              customCategory={customCategory}
              setCustomCategory={setCustomCategory}
              t={t}
            />

            <NewsTargetFilters
              newNews={newNews as any}
              onSetNewNews={onSetNewNews}
              semester={semester}
              setSemester={setSemester}
              levels={levels}
              availableDepartments={availableDepartments}
              subjects={subjects}
              subjectsLoading={subjectsLoading}
              t={t}
            />

            <NewsMediaUploads
              fileFile={fileFile}
              setFileFile={setFileFile}
              imageFiles={imageFiles}
              setImageFiles={setImageFiles}
              setError={setError}
              t={t}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("newsPriority")}
              </label>
              <input
                type="number"
                value={newNews.priority}
                onChange={(e) =>
                  onSetNewNews({
                    ...newNews,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder={t("newsPriorityPlaceholder")}
                min="0"
                max="10"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddNews}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("newsPublishing") : t("newsPublish")}
            </button>
            <button
              onClick={() => onSetShowAddNews(false)}
              className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {t("newsCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
