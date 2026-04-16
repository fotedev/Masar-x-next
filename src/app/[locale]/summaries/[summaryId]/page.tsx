"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  User,
  Download,
  FileText,
  Flag,
  Edit,
  Play,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Summary, Quiz } from "@/types/database";
import { AppealFormModal } from "@/components/AppealFormModal";
import { ReviewSection } from "@/components/ReviewSection";
import { SUBJECT_ICONS } from "@/constants/subjects";

interface ExtendedSummary extends Summary {
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  youtube_url: string | null;
}

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
};

export default function SummaryDetailPage() {
  const params = useParams();
  const summaryId = params?.summaryId as string;
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { trackSummaryView } = useAnalytics();
  const [summary, setSummary] = useState<ExtendedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [summaryImages, setSummaryImages] = useState<string[]>([]);
  const [cleanContent, setCleanContent] = useState("");
  const [linkedQuiz, setLinkedQuiz] = useState<Quiz | null>(null);

  const extractImagesFromContent = (content: string) => {
    const imagesMatch = content.match(/\[IMAGES:(\[.*?\])\]/);
    if (imagesMatch) {
      try {
        const images = JSON.parse(imagesMatch[1]);
        const cleanContent = content.replace(/\[IMAGES:(\[.*?\])\]/, "").trim();
        return { images, cleanContent };
      } catch {
        return { images: [], cleanContent: content };
      }
    }
    return { images: [], cleanContent: content };
  };

  const fetchSummary = useCallback(async () => {
    try {
      const { data: summaryData, error: summaryError } = await supabase
        .from("summaries")
        .select("*")
        .eq("id", summaryId)
        .eq("status", "approved")
        .maybeSingle();

      if (summaryError) throw summaryError;

      if (!summaryData) {
        setError("الملخص غير موجود أو قيد المراجعة");
        return;
      }

      // Fetch profile separately since the relationship might be missing in the schema cache
      let profileData = null;
      if (summaryData.user_id) {
        try {
          const { data: pData } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, username")
            .eq("id", summaryData.user_id)
            .maybeSingle();
          profileData = pData;
        } catch {
          profileData = null;
        }
      }

      const fullSummary = { ...summaryData, profiles: profileData };
      setSummary(fullSummary);

      // Track summary view
      trackSummaryView(summaryData.id, {
        subject: summaryData.subject,
        year: summaryData.year,
        department: summaryData.department,
      });

      // Extract images from content
      const { images, cleanContent } = extractImagesFromContent(
        summaryData.content,
      );
      setSummaryImages(images);
      setCleanContent(cleanContent);

      // Fetch linked quiz (only approved for normal users)
      let quizQuery = supabase
        .from("quizzes")
        .select("*")
        .eq("summary_id", summaryId);

      // Normal users should only see approved quizzes
      if (!isAdmin) {
        quizQuery = quizQuery.eq("status", "approved");
      }

      const { data: quizData } = await quizQuery.maybeSingle();

      if (quizData) {
        setLinkedQuiz(quizData);
      }
    } catch {
      setError("حدث خطأ أثناء تحميل الملخص");
    } finally {
      setLoading(false);
    }
  }, [summaryId, isAdmin, trackSummaryView]);

  useEffect(() => {
    if (summaryId) {
      fetchSummary();
    }
  }, [summaryId, fetchSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">
            جاري التحميل...
          </p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center transition-colors">
          <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error}
          </h2>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            العودة إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>العودة إلى القائمة</span>
      </button>

      <div className="modern-card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-navy to-brand-blue px-6 sm:px-10 py-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-4xl font-extrabold mb-6 tracking-tight leading-tight">
              {summary.title}
            </h1>

            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                {(() => {
                  const IconComponent =
                    SUBJECT_ICONS[summary.subject] || BookOpen;
                  return <IconComponent className="w-4 h-4 text-brand-sky" />;
                })()}
                <span>{summary.subject}</span>
              </div>

              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <Calendar className="w-4 h-4 text-brand-orange" />
                <span>
                  {summary.year} - {summary.department}
                </span>
              </div>

              {summary.contributor_name && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10">
                  {summary.profiles?.avatar_url ? (
                    <div className="w-8 h-8 relative">
                      <Image
                        src={summary.profiles.avatar_url}
                        alt="Contributor Avatar"
                        fill
                        sizes="32px"
                        className="rounded-full object-cover border border-white/20"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <span>{summary.contributor_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {summary.pdf_url && (
            <div className="mb-10 p-6 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-2xl border border-brand-blue/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-brand-blue p-3 rounded-2xl shadow-lg shadow-brand-blue/20">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-center sm:text-right">
                  <p className="font-bold text-slate-900 dark:text-white text-lg">
                    ملف PDF متاح
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    حمل الملخص بصيغة PDF للمذاكرة في أي وقت
                  </p>
                </div>
              </div>
              <a
                href={summary.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-blue text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-sky shadow-lg shadow-brand-blue/25 transition-all duration-300"
              >
                <Download className="w-5 h-5" />
                <span>تحميل الآن</span>
              </a>
            </div>
          )}

          {linkedQuiz && (
            <div className="mb-10 p-6 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-600 p-3 rounded-2xl shadow-lg shadow-green-600/20">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <div className="text-center sm:text-right">
                  <p className="font-bold text-slate-900 dark:text-white text-lg">
                    اختبر معلوماتك
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {linkedQuiz.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  router.push(`/quiz-play/${linkedQuiz.id}`)
                }
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-600/25 transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                <span>ابدأ الامتحان</span>
              </button>
            </div>
          )}

          {summary.youtube_url && getYouTubeEmbedUrl(summary.youtube_url) && (
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-red-600 rounded-full" />
                شرح الفيديو
              </h2>
              <div className="relative pt-[56.25%] w-full overflow-hidden rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                <iframe
                  src={getYouTubeEmbedUrl(summary.youtube_url)!}
                  className="absolute top-0 left-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="YouTube video player"
                ></iframe>
              </div>
            </div>
          )}

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-brand-blue rounded-full" />
              محتوى الملخص
            </h2>
            <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-lg">
              {cleanContent}
            </div>

            {summaryImages.length > 0 && (
              <div className="mt-12">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-brand-orange rounded-full" />
                  الصور المرفقة
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {summaryImages.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative group overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 h-64"
                    >
                      <Image
                        src={imageUrl}
                        alt={`صورة ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                        onClick={() => window.open(imageUrl, "_blank")}
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(imageUrl, "_blank");
                          }}
                          className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 text-sm font-bold hover:bg-white/30 transition-colors cursor-pointer"
                        >
                          عرض الصورة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <p className="text-sm font-medium text-slate-400">
                تم النشر في{" "}
                {new Date(summary.created_at).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAppealForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange/10 text-brand-orange rounded-xl hover:bg-brand-orange/20 transition-all text-sm font-bold"
                >
                  <Flag className="w-4 h-4" />
                  <span>الطعن في المحتوى</span>
                </button>

                {(isAdmin || (user && user.id === summary.user_id)) && (
                  <button
                    onClick={() =>
                      router.push(`/edit-summary?id=${summary.id}`)
                    }
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue/10 text-brand-blue rounded-xl hover:bg-brand-blue/20 transition-all text-sm font-bold"
                  >
                    <Edit className="w-4 h-4" />
                    <span>تعديل الملخص</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReviewSection contentId={summary.id} contentType="summary" />

      <AppealFormModal
        isOpen={showAppealForm}
        onClose={() => setShowAppealForm(false)}
        contentId={summary.id}
        contentType="summary"
        contentTitle={summary.title}
      />
    </div>
  );
}
