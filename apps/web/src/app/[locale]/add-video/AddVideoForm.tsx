"use client";

import { useSearchParams } from "next/navigation";
import { Send, CheckCircle, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { LectureSelect } from "@/components/lectures/LectureSelect";
import { addVideo } from "@/actions/content";
import { useContentForm } from "@/hooks/useContentForm";
import { useRouter } from '@/navigation';
import { useCallback } from "react";

export function AddVideoForm() {
  const t = useTranslations("addVideo");
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

  const { handleSubmit, isPending, state } = useContentForm({
    action: addVideo,
    onSuccess: handleClose,
  });

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <p className="text-red-500 font-bold">{t("adminOnly")}</p>
        </div>
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="max-w-2xl mx-auto py-12">
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
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
        >
          <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="lectureKey" value={lectureKey} />

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("videoTitle")} <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t("videoTitlePlaceholder")}
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
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500"
            />
          </div>

          <LectureSelect
            subject={subject}
            selectedKey={lectureKey}
            onSelect={(lec) => {
              const params = new URLSearchParams(searchParams.toString());
              if (lec) params.set("lecture", lec.lecture_key);
              else params.delete("lecture");
              router.replace(`/add-video?${params.toString()}`);
            }}
            label={t("lecture")}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("videoUrl")} <span className="text-red-500">*</span>
            </label>
            <input
              name="url"
              type="url"
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dir-ltr"
              placeholder={t("videoUrlPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              {t("language")}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="relative">
                <input type="radio" name="language" value="ar" defaultChecked className="peer hidden" />
                <div className="cursor-pointer py-3 px-4 rounded-xl border-2 transition-all font-bold text-center border-gray-100 dark:border-gray-700 text-gray-500 peer-checked:border-blue-600 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:text-blue-600">
                  {t("arabic")}
                </div>
              </label>
              <label className="relative">
                <input type="radio" name="language" value="en" className="peer hidden" />
                <div className="cursor-pointer py-3 px-4 rounded-xl border-2 transition-all font-bold text-center border-gray-100 dark:border-gray-700 text-gray-500 peer-checked:border-blue-600 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:text-blue-600">
                  {t("english")}
                </div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl shadow-lg transition-all disabled:opacity-50"
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
  );
}
