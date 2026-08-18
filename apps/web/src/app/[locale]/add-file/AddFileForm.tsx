"use client";

import { useSearchParams } from "next/navigation";
import { Send, CheckCircle, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { LectureSelect } from "@/components/lectures/LectureSelect";
import { addFile } from "@/actions/content";
import { useContentForm } from "@/hooks/useContentForm";
import { useRouter } from '@/navigation';
import { useCallback } from "react";

export function AddFileForm() {
  const t = useTranslations("addFile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, loading: authLoading } = useAuth();

  const handleClose = useCallback(() => {
    const subject = searchParams.get("subject") || "";
    const lecture = searchParams.get("lecture") || "";
    if (subject) {
      router.push(`/subjects/${encodeURIComponent(subject)}${lecture ? `?lecture=${encodeURIComponent(lecture)}` : ""}`);
      return;
    }
    router.back();
  }, [router, searchParams]);

  const { handleSubmit, isPending, uploadProgress, uploadStage, state } = useContentForm({
    action: addFile,
    onSuccess: handleClose,
  });

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <p className="text-red-500 font-bold">{t("adminOnly")}</p>
        </div>
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t("success")}
          </h2>
        </div>
      </div>
    );
  }

  const subject = searchParams.get("subject") || "";
  const lectureKey = searchParams.get("lecture") || "";

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
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          {t("subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="lectureKey" value={lectureKey} />
          <input type="hidden" name="folder" value="masarx-files" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("fileTitle")} <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              className="w-full px-3 sm:px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t("fileTitlePlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("subject")}
            </label>
            <input
              type="text"
              readOnly
              value={subject}
              className="w-full px-3 sm:px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500"
            />
          </div>

          <LectureSelect
            subject={subject}
            selectedKey={lectureKey}
            onSelect={(lec) => {
              const params = new URLSearchParams(searchParams.toString());
              if (lec) params.set("lecture", lec.lecture_key);
              else params.delete("lecture");
              router.replace(`/add-file?${params.toString()}`);
            }}
            label={t("lecture")}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("description")}
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-3 sm:px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("uploadFile")} <span className="text-red-500">*</span>
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
              className="w-full"
            />
          </div>

          {isPending && uploadStage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {uploadStage}
                </span>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {Math.round(uploadProgress)}%
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
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
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
