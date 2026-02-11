"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "../../components/NotificationManager";

export default function AddVideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, isAdminLoading } = useAuth();
  const { sendNotification } = useBrowserNotifications();

  const [formData, setFormData] = useState({
    title: "",
    subject: searchParams.get("subject") || "",
    url: "",
    language: "ar" as "ar" | "en",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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

    try {
      // Validate URL
      try {
        new URL(formData.url);
      } catch {
        setError("يرجى إدخال رابط صحيح");
        setLoading(false);
        return;
      }

      const videoData = {
        title: formData.title,
        subject: formData.subject,
        url: formData.url,
        language: formData.language,
        user_id: user?.id,
      };

      const { error: insertError } = await supabase
        .from("videos")
        .insert(videoData);

      if (insertError) throw insertError;

      setSuccess(true);

      sendNotification("تم إضافة الفيديو بنجاح!", {
        body: `فيديو "${formData.title}" تم إضافته`,
        icon: "/logo.png",
        tag: "video-added",
      });

      setTimeout(() => {
        router.push(`/subjects/${encodeURIComponent(formData.subject)}`);
      }, 2000);
    } catch (err) {
      console.error("Error adding video:", err);
      setError("حدث خطأ أثناء إضافة الفيديو. يرجى المحاولة مرة أخرى.");
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
            تم إضافة الفيديو بنجاح!
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            الفيديو متاح الآن للطلاب
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
          إضافة فيديو جديد
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          أضف فيديو تعليمي للمادة
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label
              htmlFor="video-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              عنوان الفيديو <span className="text-red-500">*</span>
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
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="مثال: شرح الفصل الأول - مقدمة في البرمجة"
            />
          </div>

          <div>
            <label
              htmlFor="video-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              اسم المادة <span className="text-red-500">*</span>
            </label>
            <input
              id="video-subject"
              name="videoSubject"
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
              htmlFor="video-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              رابط الفيديو <span className="text-red-500">*</span>
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
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              لغة الفيديو <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="language"
                  value="ar"
                  checked={formData.language === "ar"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      language: e.target.value as "ar" | "en",
                    })
                  }
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  عربي
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={formData.language === "en"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      language: e.target.value as "ar" | "en",
                    })
                  }
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  إنجليزي
                </span>
              </label>
            </div>
          </div>

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
                <span>إضافة الفيديو</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
