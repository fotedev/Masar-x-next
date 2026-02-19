import React, { useState, useEffect, useMemo } from "react";
import { X, Upload, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useSubjects } from "../hooks/useSubjects";
import type { Summary, SummaryWithRatings } from "../types/database";
import { FileDropzone } from "./FileDropzone";
import { useAcademicOptions } from "../hooks/useAcademicOptions";

interface EditSummaryModalProps {
  summary: Summary | SummaryWithRatings | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: any) => Promise<void>;
}

export function EditSummaryModal({
  summary,
  isOpen,
  onClose,
  onSave,
}: EditSummaryModalProps) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    year: "",
    department: "",
    content: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachmentType, setAttachmentType] = useState<"file" | "link">("file");
  const [driveLink, setDriveLink] = useState<string>("");

  useEffect(() => {
    if (summary && isOpen) {
      setFormData({
        title: summary.title,
        subject: summary.subject,
        year: summary.year,
        department: summary.department,
        content: summary.content,
      });
      setPdfFile(null);
      setAttachmentType("file");
      setDriveLink("");
      setError("");
    }
  }, [summary, isOpen]);

  const availableDepartments = useMemo(() => {
    if (!formData.year) return [];
    return getDepartmentsForLevelName(formData.year);
  }, [formData.year, getDepartmentsForLevelName]);

  useEffect(() => {
    if (!formData.year) {
      if (formData.department) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
      return;
    }

    if (formData.department) {
      const exists = availableDepartments.some(
        (d) => d.name === formData.department,
      );
      if (!exists) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
    }
  }, [formData.year, formData.department, availableDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !user) return;

    setLoading(true);
    setError("");

    try {
      // Validate attachment data
      if (attachmentType === "link" && driveLink.trim()) {
        // Basic URL validation
        try {
          new URL(driveLink.trim());
        } catch {
          setError("يرجى إدخال رابط صحيح");
          return;
        }
      } else if (attachmentType === "link" && !driveLink.trim()) {
        setError("يرجى إدخال رابط Google Drive أو اختر رفع ملف");
        return;
      }

      let pdfUrl = summary.pdf_url;

      if (attachmentType === "file" && pdfFile) {
        // Upload new PDF to Supabase Storage
        const originalName = pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const timestamp = Date.now();
        const filePath = `summaries/${timestamp}_${originalName}`;

        const { error: uploadError } = await supabase.storage
          .from("summaries-pdfs")
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("summaries-pdfs").getPublicUrl(filePath);

        pdfUrl = publicUrl;
      } else if (attachmentType === "link") {
        // Use Google Drive link
        pdfUrl = driveLink.trim() || null;
      }

      await onSave(summary.id, {
        title: formData.title,
        subject: formData.subject,
        year: formData.year,
        department: formData.department,
        content: formData.content,
        pdf_url: pdfUrl,
      });

      onClose();
    } catch {
      setError("حدث خطأ أثناء تحديث الملخص. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              عنوان الملخص <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                التخصص <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                disabled={!formData.year || availableDepartments.length === 0}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">اختر التخصص</option>
                {availableDepartments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المستوى الدراسي <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value,
                    department: "",
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">اختر المستوى</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.name}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              اسم المادة <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">اختر المادة</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              محتوى الملخص <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              تحديث المرفقات (اختياري)
            </label>

            {/* نوع المرفق */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
                اختر نوع المرفق:
              </p>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="attachmentType"
                  value="file"
                  checked={attachmentType === "file"}
                  onChange={(e) => setAttachmentType(e.target.value as "file")}
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  رفع ملف PDF
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="attachmentType"
                  value="link"
                  checked={attachmentType === "link"}
                  onChange={(e) => setAttachmentType(e.target.value as "link")}
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  رابط Google Drive
                </span>
              </label>
            </div>

            {/* رفع الملف */}
            {attachmentType === "file" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  تحديث ملف PDF
                </label>
                <FileDropzone
                  onFileSelect={(files) => {
                    if (files.length > 0) {
                      const file = files[0];
                      if (file && file.type === "application/pdf") {
                        setPdfFile(file);
                        setError("");
                      } else {
                        setError("يرجى اختيار ملف PDF فقط");
                        setPdfFile(null);
                      }
                    }
                  }}
                  accept=".pdf"
                  className="w-full h-32"
                >
                  <div className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                      {pdfFile ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {pdfFile.name}
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">
                              اضغط لتحديث ملف PDF
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            PDF فقط (حتى 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </FileDropzone>
              </div>
            )}

            {/* رابط Google Drive */}
            {attachmentType === "link" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  رابط Google Drive
                </label>
                <input
                  type="url"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  تأكد من أن الرابط قابل للوصول للجميع (عام)
                </p>
              </div>
            )}
          </div>

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
