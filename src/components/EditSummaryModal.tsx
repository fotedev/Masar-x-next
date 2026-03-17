import React from "react";
import { X, Save } from "lucide-react";
import type {
  Summary,
  SummaryUpdate,
  SummaryWithRatings,
} from "../types/database";
import { AttachmentSection } from "./edit-summary/AttachmentSection";
import { SummaryFormFields } from "./edit-summary/SummaryFormFields";
import { useEditSummary } from "../hooks/useEditSummary";

interface EditSummaryModalProps {
  summary: Summary | SummaryWithRatings | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: SummaryUpdate) => Promise<void>;
}

export function EditSummaryModal({
  summary,
  isOpen,
  onClose,
  onSave,
}: EditSummaryModalProps) {
  const {
    formData,
    setFormData,
    semester,
    setSemester,
    levels,
    subjects,
    availableDepartments,
    pdfFile,
    setPdfFile,
    loading,
    error,
    setError,
    attachmentType,
    setAttachmentType,
    driveLink,
    setDriveLink,
    handleSubmit,
  } = useEditSummary({
    summary,
    isOpen,
    onClose,
    onSave,
  });

  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            تعديل الملخص
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4">
              {error}
            </div>
          )}

          <SummaryFormFields
            formData={formData}
            setFormData={setFormData}
            levels={levels}
            availableDepartments={availableDepartments}
            subjects={subjects}
            semester={semester}
            setSemester={setSemester}
          />

          <AttachmentSection
            attachmentType={attachmentType}
            setAttachmentType={setAttachmentType}
            pdfFile={pdfFile}
            setPdfFile={setPdfFile}
            driveLink={driveLink}
            setDriveLink={setDriveLink}
            setError={setError}
          />

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>حفظ التغييرات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
