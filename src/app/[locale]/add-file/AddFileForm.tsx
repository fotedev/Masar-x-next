"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, Send, CheckCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "@/components/NotificationManager";
import { FileDropzone } from "@/components/FileDropzone";
import { LectureSelect } from "@/components/lectures/LectureSelect";

export function AddFileForm() {
  const t = useTranslations("addFile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, isAdminLoading } = useAuth();
  const { sendNotification } = useBrowserNotifications();

  const handleClose = useCallback(() => {
    const subject = searchParams.get("subject") || "";
    const lecture = searchParams.get("lecture") || "";
    if (subject) {
      const url = `/subjects/${encodeURIComponent(subject)}${lecture ? `?lecture=${encodeURIComponent(lecture)}` : ""}`;
      router.push(url);
      return;
    }
    router.back();
  }, [router, searchParams]);

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    description: "",
    externalUrl: "",
  });

  const [uploadType, setUploadType] = useState<"file" | "link">("link");

  useEffect(() => {
    const subject = searchParams.get("subject") || "";
    const lectureKey = searchParams.get("lecture") || "";

    setFormData((prev) => {
      let title = prev.title;
      // Pre-fill title if it's empty and we have a lecture title from query
      if (!title && lectureKey) {
        if (lectureKey.startsWith("lec-")) {
          const lectureNum = lectureKey.replace("lec-", "");
          title = `محاضرة ${lectureNum}: `;
        } else {
          // If it's a custom key/label like "Partial fractions"
          title = `${lectureKey}: `;
        }
      }

      return { ...prev, subject, title: title || prev.title };
    });
  }, [searchParams]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      handleClose();
      return;
    }
  }, [isAdmin, isAdminLoading, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentLectureKey = (searchParams.get("lecture") || "").trim();
    if (!currentLectureKey) {
      setError(t("selectLectureFirst"));
      return;
    }

    setLoading(true);
    setError("");
    setUploadProgress(0);
    setUploadStage("");

    try {
      const lectureKey = (searchParams.get("lecture") || "").trim();
      let lectureId: string | null = null;

      if (lectureKey) {
        const { data: lectureRow, error: lectureError } = await supabase
          .from("subject_lectures")
          .select("id,lecture_key,subject")
          .eq("subject", formData.subject)
          .eq("lecture_key", lectureKey)
          .maybeSingle();

        if (lectureError) {
          console.error("Lecture lookup error:", lectureError);
          setError(t("error"));
          setLoading(false);
          return;
        }

        if (!lectureRow) {
          setError(
            t("lectureNotFound", { lectureKey, subject: formData.subject }),
          );
          setLoading(false);
          return;
        }

        // Double check subject match (extra safety)
        if (lectureRow.subject !== formData.subject) {
          setError(t("lectureMismatch"));
          setLoading(false);
          return;
        }

        lectureId = lectureRow.id || null;
      }

      if (uploadType === "file" && !file) {
        setError(t("selectFile"));
        setLoading(false);
        return;
      }

      if (uploadType === "link" && !formData.externalUrl) {
        setError(t("error")); // Or a more specific key if available
        setLoading(false);
        return;
      }

      let finalFileUrl = formData.externalUrl;

      if (uploadType === "file" && file) {
        // Upload file to Cloudinary
        setUploadStage(t("uploading", { progress: 0 }));
        const cloudinaryResult = await uploadToCloudinary(file, {
          folder: "masarx-files",
          onProgress: (progress) => {
            setUploadProgress(progress);
            setUploadStage(t("uploading", { progress }));
          },
        });
        finalFileUrl = cloudinaryResult.url;
      }

      // Insert into files table
      const fileData = {
        title: formData.title,
        subject: formData.subject,
        file_url: finalFileUrl,
        description: formData.description,
        user_id: user?.id,
        lecture_key: lectureKey || null,
        lecture_id: lectureId,
      };

      const { error: insertError } = await supabase
        .from("files")
        .insert(fileData);

      if (insertError) throw insertError;

      setSuccess(true);

      sendNotification(t("success"));

      setTimeout(() => {
        const lecture = searchParams.get("lecture") || "";
        const url = `/subjects/${encodeURIComponent(formData.subject)}${lecture ? `?lecture=${encodeURIComponent(lecture)}` : ""}`;
        router.push(url);
      }, 2000);
    } catch {
      setError(t("error"));
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
            {t("adminOnly")}
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
            {t("success")}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            {formData.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 transition-colors">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            {t("title")}
          </h1>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
            aria-label={t("newsCancel", { ns: "news" }) || "إلغاء"}
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          {t("subtitle")}
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
              {t("fileTitle")} <span className="text-red-500">*</span>
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
              placeholder={t("fileTitlePlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="file-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("subject")} <span className="text-red-500">*</span>
            </label>
            <input
              id="file-subject"
              name="fileSubject"
              type="text"
              required
              readOnly
              value={formData.subject}
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 placeholder-gray-500 dark:placeholder-gray-400 text-base"
            />
          </div>

          <div>
            <LectureSelect
              subject={formData.subject}
              selectedKey={searchParams.get("lecture") || ""}
              onSelect={(lec) => {
                const newParams = new URLSearchParams(searchParams.toString());
                if (lec) {
                  newParams.set("lecture", lec.lecture_key);
                } else {
                  newParams.delete("lecture");
                }
                router.replace(
                  `${window.location.pathname}?${newParams.toString()}`,
                );
              }}
              label={t("lecture")}
            />
          </div>

          <div>
            <label
              htmlFor="file-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("description")}
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
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("uploadFile")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => setUploadType("link")}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  uploadType === "link"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                Drive
              </button>
              <button
                type="button"
                onClick={() => setUploadType("file")}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  uploadType === "file"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                File
              </button>
            </div>
          </div>

          {uploadType === "file" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("uploadFile")} <span className="text-red-500">*</span>
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
                            {t("fileDropzoneIdle", { ns: "common" }) ||
                              "Click or drag files here to upload"}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </FileDropzone>
            </div>
          ) : (
            <div>
              <label
                htmlFor="external-url"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Drive <span className="text-red-500">*</span>
              </label>
              <input
                id="external-url"
                type="url"
                required
                value={formData.externalUrl}
                onChange={(e) =>
                  setFormData({ ...formData, externalUrl: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="https://drive.google.com/..."
              />
            </div>
          )}

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
                <span>{t("submitting")}</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>{t("submit")}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
