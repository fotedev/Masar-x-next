"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "@/components/NotificationManager";
import { LectureSelect } from "@/components/lectures/LectureSelect";

export function AddVideoForm() {
  const t = useTranslations("addVideo");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, isAdminLoading } = useAuth();
  const { sendNotification } = useBrowserNotifications();

  const handleClose = () => {
    const subject = searchParams.get("subject") || "";
    const lecture = searchParams.get("lecture") || "";
    if (subject) {
      const url = `/subjects/${encodeURIComponent(subject)}${lecture ? `?lecture=${encodeURIComponent(lecture)}` : ""}`;
      router.push(url);
      return;
    }
    router.back();
  };

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    url: "",
    language: "ar" as "ar" | "en",
  });

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

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentLectureKey = (searchParams.get("lecture") || "").trim();
    if (!currentLectureKey) {
      setError(t("selectLectureFirst"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const lectureKey = (searchParams.get("lecture") || "").trim();
      let lectureId: string | null = null;

      // Validate URL
      try {
        new URL(formData.url);
      } catch {
        setError(t("invalidUrl"));
        setLoading(false);
        return;
      }

      if (lectureKey) {
        const { data: lectureRow, error: lectureError } = await supabase
          .from("subject_lectures")
          .select("id,lecture_key,subject")
          .eq("subject", formData.subject)
          .eq("lecture_key", lectureKey)
          .maybeSingle();

        if (lectureError) {
          // console.error("Lecture lookup error:", lectureError);
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

        if (lectureRow.subject !== formData.subject) {
          setError(t("lectureMismatch"));
          setLoading(false);
          return;
        }

        lectureId = lectureRow.id || null;
      }

      const videoData = {
        title: formData.title,
        subject: formData.subject,
        url: formData.url,
        language: formData.language,
        lecture_key: lectureKey || null,
        lecture_id: lectureId,
        user_id: user?.id,
      };

      const { error: insertError } = await supabase
        .from("videos")
        .insert([videoData]);

      if (insertError) throw insertError;

      setSuccess(true);
      sendNotification(t("success"));

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      // console.error("Error adding video:", err);
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (isAdminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t("adminOnly")}
          </h2>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t("success")}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{formData.title}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t("title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
          <div>
            <label
              htmlFor="video-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("videoTitle")} <span className="text-red-500">*</span>
            </label>
            <input
              id="video-title"
              name="videoTitle"
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder={t("videoTitlePlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="video-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("subject")} <span className="text-red-500">*</span>
            </label>
            <input
              id="video-subject"
              name="videoSubject"
              type="text"
              required
              readOnly
              value={formData.subject}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
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
              htmlFor="video-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t("videoUrl")} <span className="text-red-500">*</span>
            </label>
            <input
              id="video-url"
              name="videoUrl"
              type="url"
              required
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white dir-ltr"
              placeholder={t("videoUrlPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              {t("language")}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, language: "ar" })}
                className={`py-3 px-4 rounded-xl border-2 transition-all font-bold ${
                  formData.language === "ar"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    : "border-gray-100 dark:border-gray-700 text-gray-500"
                }`}
              >
                {t("arabic")}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, language: "en" })}
                className={`py-3 px-4 rounded-xl border-2 transition-all font-bold ${
                  formData.language === "en"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    : "border-gray-100 dark:border-gray-700 text-gray-500"
                }`}
              >
                {t("english")}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t("submitting")}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {t("submit")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            {t("newsCancel", { ns: "news" }) || "إلغاء"}
          </button>
        </div>
      </form>
    </div>
  );
}
