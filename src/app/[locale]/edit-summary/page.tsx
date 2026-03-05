"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Upload, Save, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "@/components/NotificationManager";
import { useSubjects } from "@/hooks/useSubjects";
import { FileDropzone } from "@/components/FileDropzone";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";

function EditSummaryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const summaryId =
    (params?.summaryId as string) || (searchParams?.get("id") as string);
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { sendNotification } = useBrowserNotifications();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();
  const [semester, setSemester] = useState<number>(1);

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    year: "",
    department: "",
    content: "",
  });

  const selectedLevelNumber = useMemo(() => {
    if (!formData.year) return null;
    const found = levels.find((l) => l.name === formData.year);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [formData.year, levels]);

  const { subjects } = useSubjects({
    level: selectedLevelNumber,
    semester: typeof semester === "number" ? semester : null,
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStage, setUploadStage] = useState<string | null>(null);

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
  }, [availableDepartments, formData.department, formData.year]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!summaryId || !user) return;

      try {
        const { data, error } = await supabase
          .from("summaries")
          .select("*")
          .eq("id", summaryId)
          .single();

        if (error) throw error;

        // Check permissions
        if (data.user_id !== user?.id && !isAdmin) {
          setError("ليس لديك صلاحية لتعديل هذا الملخص");
          setLoading(false);
          return;
        }

        setFormData({
          title: data.title,
          subject: data.subject,
          year: data.year,
          department: data.department,
          content: data.content,
        });
        setSemester(1);
        setCurrentPdfUrl(data.pdf_url);
      } catch {
        setError("حدث خطأ أثناء تحميل بيانات الملخص");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [summaryId, user, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setUploadProgress(null);
    setUploadStage(null);

    try {
      let pdfUrl = currentPdfUrl;

      if (pdfFile) {
        const cloudinaryResult = await uploadToCloudinary(pdfFile, {
          folder: "masarx-summaries",
          onProgress: (progress, stage) => {
            setUploadProgress(progress);
            setUploadStage(stage);
          },
        });
        pdfUrl = cloudinaryResult.url;
      }

      const { error: updateError } = await supabase
        .from("summaries")
        .update({
          title: formData.title,
          subject: formData.subject,
          year: formData.year,
          department: formData.department,
          content: formData.content,
          pdf_url: pdfUrl,
        })
        .eq("id", summaryId);

      if (updateError) throw updateError;

      setSuccess(true);

      sendNotification("تم تعديل الملخص بنجاح!", {
        body: `تم تحديث ملخص "${formData.title}"`,
        icon: "/logo.png",
        tag: "summary-updated",
      });

      setTimeout(() => {
        router.push(`/summaries/${summaryId}`);
      }, 2000);
    } catch {
      setError("حدث خطأ أثناء تحديث الملخص. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStage(null);
      }, 500);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            تم تحديث الملخص بنجاح!
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
            سيتم تحويلك إلى صفحة الملخص...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 transition-colors">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push(`/summaries/${summaryId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowRight className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            تعديل الملخص
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label
              htmlFor="summary-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              عنوان الملخص <span className="text-red-500">*</span>
            </label>
            <input
              id="summary-title"
              name="summaryTitle"
              type="text"
              required
              autoComplete="off"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="summary-year"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                المستوى الدراسي <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-year"
                name="summaryYear"
                required
                autoComplete="off"
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value,
                    department: "",
                    subject: "",
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">اختر المستوي</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.name}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="summary-semester"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                الترم <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-semester"
                name="summarySemester"
                required
                autoComplete="off"
                value={semester}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setSemester(next);
                  setFormData((prev) => ({
                    ...prev,
                    department: "",
                    subject: "",
                  }));
                }}
                disabled={!formData.year}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
              >
                <option value={1}>ترم 1</option>
                <option value={2}>ترم 2</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="summary-department"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                التخصص <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-department"
                name="summaryDepartment"
                required
                autoComplete="off"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                disabled={!formData.year || availableDepartments.length === 0}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">اختر التخصص</option>
                {availableDepartments.map((dep) => (
                  <option key={dep.id} value={dep.name}>
                    {dep.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="summary-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              اسم المادة <span className="text-red-500">*</span>
            </label>
            <select
              id="summary-subject"
              name="summarySubject"
              required
              autoComplete="off"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <label
              htmlFor="summary-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              محتوى الملخص <span className="text-red-500">*</span>
            </label>
            <textarea
              id="summary-content"
              name="summaryContent"
              required
              autoComplete="off"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              rows={10}
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              تحديث ملف PDF (اختياري)
            </label>
            {uploadProgress !== null && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <span>{uploadStage || "جاري رفع الملف..."}</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600"
                    style={{
                      width: `${Math.min(100, Math.max(0, uploadProgress))}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {currentPdfUrl && !pdfFile && (
              <div className="mb-2 text-sm text-blue-600 dark:text-blue-400">
                يوجد ملف PDF حالي. قم برفع ملف جديد لاستبداله.
              </div>
            )}
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
                          اضغط أو اسحب لرفع ملف PDF جديد
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

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-lg font-medium focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base touch-manipulation"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function EditSummaryPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto" />}>
      <EditSummaryContent />
    </Suspense>
  );
}
