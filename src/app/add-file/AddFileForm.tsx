"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, Send, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "../../components/NotificationManager";
import { FileDropzone } from "../../components/FileDropzone";

export function AddFileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, isAdminLoading } = useAuth();
  const { sendNotification } = useBrowserNotifications();

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    description: "",
  });

  useEffect(() => {
    const subject = searchParams.get("subject") || "";
    setFormData(prev => ({ ...prev, subject }));
  }, [searchParams]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.push("/");
      return;
    }
  }, [isAdmin, isAdminLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUploadProgress(0);
    setUploadStage("");

    try {
      if (!file) {
        setError("يرجى اختيار ملف");
        setLoading(false);
        return;
      }

      // Upload file to Cloudinary
      setUploadStage("جاري رفع الملف...");
      const cloudinaryResult = await uploadToCloudinary(file, {
        folder: "masarx-files",
        onProgress: (progress, stage) => {
          setUploadProgress(progress);
          setUploadStage(stage);
        },
      });

      console.log("File uploaded to Cloudinary:", cloudinaryResult.public_id);

      // Insert into files table
      const fileData = {
        title: formData.title,
        subject: formData.subject,
        file_url: cloudinaryResult.url,
        description: formData.description,
        user_id: user?.id,
      };

      const { error: insertError } = await supabase
        .from("files")
        .insert(fileData);

      if (insertError) throw insertError;

      setSuccess(true);

      sendNotification("تم إضافة الملف بنجاح!", {
        body: `ملف "${formData.title}" تم إضافته`,
        icon: "/logo.png",
        tag: "file-added",
      });

      setTimeout(() => {
        router.push(`/subjects/${encodeURIComponent(formData.subject)}`);
      }, 2000);
    } catch (err) {
      console.error("Error adding file:", err);
      setError("حدث خطأ أثناء إضافة الملف. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (isAdminLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            جاري التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            تم إضافة الملف بنجاح!
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            الملف متاح الآن للطلاب
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
            سيتم تحويلك إلى صفحة المادة...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 transition-colors">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          إضافة ملف جديد
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          أضف ملف تعليمي أو كتاب للمادة
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label
              htmlFor="file-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              عنوان الملف <span className="text-red-500">*</span>
            </label>
            <input
              id="file-title"
              name="fileTitle"
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="مثال: كتاب أساسيات الرياضيات"
            />
          </div>

          <div>
            <label
              htmlFor="file-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              اسم المادة <span className="text-red-500">*</span>
            </label>
            <input
              id="file-subject"
              name="fileSubject"
              type="text"
              required
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="مثال: أساسيات تكنولوجيا المعلومات"
            />
          </div>

          <div>
            <label
              htmlFor="file-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              وصف الملف (اختياري)
            </label>
            <textarea
              id="file-description"
              name="fileDescription"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="وصف مختصر للملف..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              رفع الملف <span className="text-red-500">*</span>
            </label>
            <FileDropzone
              onFileSelect={(files) => {
                if (files.length > 0) {
                  setFile(files[0]);
                  setError("");
                }
              }}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
              className="w-full h-32"
            >
              <div className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                  {file ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">
                          اضغط أو اسحب لرفع الملف
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        PDF, DOC, PPT, TXT, ZIP (حتى 50MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </FileDropzone>
          </div>

          {loading && uploadStage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {uploadStage}
                </span>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-lg font-medium focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base touch-manipulation"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>جاري الإضافة...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>إضافة الملف</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
