"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Calendar,
  User,
  Video,
  FolderOpen,
  ClipboardList,
  Plus,
  Play,
  X,
} from "lucide-react";
import { useSummaries } from "../../../hooks/useSummaries";
import { useAuth } from "../../../contexts/AuthContext";
import { useAnalytics } from "../../../hooks/useAnalytics";
import { EditSummaryModal } from "../../../components/EditSummaryModal";
import { supabase } from "../../../lib/supabase";
import { Quiz, Summary } from "../../../types/database";
import { useVideos } from "../../../hooks/useVideos";
import { useFiles } from "../../../hooks/useFiles";

import { Suspense } from "react";
// ... imports

function SubjectSummariesContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectId = (params?.subject as string) || searchParams?.get("subject");
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const summariesHook = useSummaries();
  const { trackSummaryClick } = useAnalytics();
  const [filteredSummaries, setFilteredSummaries] = useState<Summary[]>([]);
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "summaries" | "videos" | "files" | "exams"
  >("summaries");
  const [activeVideoLang, setActiveVideoLang] = useState<"ar" | "en">("ar");
  const [subjectQuizzes, setSubjectQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [showAddExamForm, setShowAddExamForm] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [examFormData, setExamFormData] = useState({
    title: "",
    description: "",
    durationMinutes: "",
    department: "",
    year: "",
    questions: [
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
      },
    ],
  });

  // Decode subject name from URL
  const subjectName = subjectId ? decodeURIComponent(subjectId) : "";

  const normalizedSubjectName = useMemo(
    () => subjectName.trim(),
    [subjectName],
  );

  const { videos, loading: videosLoading } = useVideos(normalizedSubjectName);
  const { files, loading: filesLoading } = useFiles(normalizedSubjectName);

  useEffect(() => {
    // Filter summaries by subject
    const subjectSummaries = summariesHook.summaries
      .filter(
        (summary) =>
          summary.status === "approved" &&
          summary.subject === normalizedSubjectName,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    setFilteredSummaries(subjectSummaries);
  }, [summariesHook.summaries, normalizedSubjectName]);

  const fetchSubjectQuizzes = useCallback(async () => {
    if (!normalizedSubjectName || activeTab !== "exams") return;

    try {
      setQuizzesLoading(true);

      // Some quizzes store subject/department/year inside description JSON (see QuizDashboardPage).
      // To support both legacy and new formats, we fetch a recent batch and filter client-side.
      let query = supabase.from("quizzes").select("*");
      if (!isAdmin) query = query.eq("status", "approved");

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      const quizzes = (data || []).filter((q) => {
        const directSubject = (q as any).subject as string | null | undefined;
        if (directSubject && directSubject.trim() === normalizedSubjectName)
          return true;

        const desc = (q as any).description as string | null | undefined;
        if (!desc || !desc.trim().startsWith("{")) return false;

        try {
          const parsed = JSON.parse(desc);
          return (
            typeof parsed?.subject === "string" &&
            parsed.subject.trim() === normalizedSubjectName
          );
        } catch {
          return false;
        }
      });

      setSubjectQuizzes(quizzes as Quiz[]);
    } catch {
      // ignore
    } finally {
      setQuizzesLoading(false);
    }
  }, [activeTab, isAdmin, normalizedSubjectName]);

  useEffect(() => {
    fetchSubjectQuizzes();
  }, [fetchSubjectQuizzes]);

  const handleSaveExam = async () => {
    if (!user) {
      alert("يجب تسجيل الدخول أولاً");
      return;
    }

    try {
      setIsSavingExam(true);

      const durationMinutesNum = examFormData.durationMinutes
        ? Number(examFormData.durationMinutes)
        : null;
      const durationSeconds =
        typeof durationMinutesNum === "number" &&
        !Number.isNaN(durationMinutesNum) &&
        durationMinutesNum > 0
          ? Math.round(durationMinutesNum * 60)
          : null;

      const descriptionData = {
        description: examFormData.description,
        department: examFormData.department,
        year: examFormData.year,
        subject: normalizedSubjectName,
      };

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: examFormData.title.trim(),
          description: JSON.stringify(descriptionData),
          summary_id: null,
          user_id: user.id,
          source_type: "manual",
          duration_seconds: durationSeconds,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = examFormData.questions.map((q, index) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        image_url: null,
        order_index: index,
      }));

      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      await fetchSubjectQuizzes();
      alert("تم حفظ الامتحان بنجاح");
      setShowAddExamForm(false);
      setExamFormData({
        title: "",
        description: "",
        durationMinutes: "",
        department: "",
        year: "",
        questions: [
          {
            question: "",
            options: ["", "", "", ""],
            correctAnswer: 0,
            explanation: "",
          },
        ],
      });
    } catch {
      alert("حدث خطأ أثناء حفظ الامتحان.");
    } finally {
      setIsSavingExam(false);
    }
  };

  const headerContent = useMemo(() => {
    switch (activeTab) {
      case "videos":
        return {
          title: `فيدوهات مادة ${normalizedSubjectName}`,
          description:
            "جميع الفيديوهات المتاحة لهذه المادة، مرتبة حسب اللغة لتسهيل المذاكرة",
        };
      case "files":
        return {
          title: `ملفات مادة ${normalizedSubjectName}`,
          description: "الكتب والملفات المساعدة الخاصة بهذه المادة",
        };
      case "exams":
        return {
          title: `امتحانات مادة ${normalizedSubjectName}`,
          description: "اختبر نفسك بامتحانات/كويزات خاصة بهذه المادة",
        };
      case "summaries":
      default:
        return {
          title: `ملخصات مادة ${normalizedSubjectName}`,
          description:
            "جميع الملخصات المتاحة لهذه المادة، منسقة ومراجعة لضمان أفضل تجربة تعلم",
        };
    }
  }, [activeTab, normalizedSubjectName]);

  const handleEditSummary = (summary: Summary) => {
    setEditingSummary(summary);
    setShowEditModal(true);
  };

  const handleSaveSummary = async (id: string, updates: any) => {
    await summariesHook.editSummary(id, updates);
    setShowEditModal(false);
    setEditingSummary(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          {headerContent.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {headerContent.description}
        </p>
      </div>

      {/* Tabs */}
      <div className="modern-card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setActiveTab("summaries")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "summaries"
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            ملخصات
          </button>

          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "videos"
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Video className="w-4 h-4" />
            فيدوهات
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "files"
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            ملفات
          </button>

          <button
            onClick={() => setActiveTab("exams")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "exams"
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            إمتحانات
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "summaries" && (
        <>
          {filteredSummaries.length === 0 ? (
            <div className="modern-card p-12 text-center">
              <FileText className="w-20 h-20 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                لا توجد ملخصات
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                لا توجد ملخصات متاحة لهذه المادة حالياً، كن أول من يساهم!
              </p>
              <button
                onClick={() =>
                  router.push(
                    `/add-summary?subject=${encodeURIComponent(normalizedSubjectName)}`,
                  )
                }
                className="px-6 py-3 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200"
              >
                أضف ملخص
              </button>
            </div>
          ) : (
            <div className="summary-grid">
              {filteredSummaries.map((summary) => {
                const canEdit =
                  user && (isAdmin || summary.user_id === user.id);

                return (
                  <div
                    key={summary.id}
                    className="modern-card p-6 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
                    onClick={() => {
                      trackSummaryClick(summary.id, "subject_page_click");
                      router.push(`/summaries/${summary.id}`);
                    }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-2 pr-2">
                        {summary.title}
                      </h2>
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSummary(summary);
                          }}
                          className="text-slate-400 hover:text-brand-blue p-2 rounded-xl hover:bg-brand-blue/5 transition-all"
                          title="تعديل الملخص"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        <Calendar className="w-4 h-4 text-brand-orange" />
                        <span className="truncate">
                          {summary.year} - {summary.department}
                        </span>
                      </div>

                      {summary.contributor_name && (
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                          <User className="w-4 h-4 text-brand-blue" />
                          <span className="truncate">
                            {summary.contributor_name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {summary.content}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">
                        {new Date(summary.created_at).toLocaleDateString(
                          "ar-EG",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                      <span className="text-brand-blue text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        اقرأ المزيد ←
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "videos" && (
        <div className="space-y-4">
          <div className="modern-card p-3 sm:p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveVideoLang("ar")}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeVideoLang === "ar"
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                عربي
              </button>
              <button
                onClick={() => setActiveVideoLang("en")}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeVideoLang === "en"
                    ? "bg-brand-blue/10 text-brand-blue"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                انجليزي
              </button>
            </div>
          </div>

          {videosLoading ? (
            <div className="modern-card p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">
                جاري التحميل...
              </p>
            </div>
          ) : (
            (() => {
              const filteredVideos = videos.filter(
                (v) => v.language === activeVideoLang,
              );
              return filteredVideos.length === 0 ? (
                <div className="modern-card p-12 text-center">
                  <Video className="w-20 h-20 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    لا توجد فيديوهات
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    لا توجد فيديوهات{" "}
                    {activeVideoLang === "ar" ? "عربية" : "إنجليزية"} لهذه
                    المادة حالياً
                  </p>
                  <button
                    onClick={() =>
                      router.push(
                        `/add-video?subject=${encodeURIComponent(normalizedSubjectName)}`,
                      )
                    }
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200"
                  >
                    أضف فيديو
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVideos.map((video) => (
                    <div key={video.id} className="modern-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">
                            {video.title}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {new Date(video.created_at).toLocaleDateString(
                              "ar-EG",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => window.open(video.url, "_blank")}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200 flex-shrink-0"
                        >
                          <Play className="w-4 h-4" />
                          مشاهدة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}

      {activeTab === "files" && (
        <div className="space-y-4">
          {filesLoading ? (
            <div className="modern-card p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">
                جاري التحميل...
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="modern-card p-12 text-center">
              <FolderOpen className="w-20 h-20 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                لا توجد ملفات
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                لا توجد ملفات متاحة لهذه المادة حالياً
              </p>
              <button
                onClick={() =>
                  router.push(
                    `/add-file?subject=${encodeURIComponent(normalizedSubjectName)}`,
                  )
                }
                className="px-6 py-3 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200"
              >
                أضف ملف
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files.map((file) => (
                <div key={file.id} className="modern-card p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-6 h-6 text-brand-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                        {file.title}
                      </h3>
                      {file.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          {file.description}
                        </p>
                      )}
                      <button
                        onClick={() => window.open(file.file_url, "_blank")}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200"
                      >
                        تحميل
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "exams" && (
        <div className="space-y-4">
          {quizzesLoading ? (
            <div className="modern-card p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">
                جاري التحميل...
              </p>
            </div>
          ) : subjectQuizzes.length === 0 ? (
            <div className="modern-card p-12 text-center">
              <ClipboardList className="w-20 h-20 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                لا توجد امتحانات
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                لا توجد امتحانات متاحة لهذه المادة حالياً
              </p>
              <button
                onClick={() => setShowAddExamForm(true)}
                className="px-6 py-3 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200"
              >
                إضافة امتحان
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjectQuizzes.map((quiz) => (
                <div key={quiz.id} className="modern-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {new Date(quiz.created_at).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        router.push(`/quiz-play?quizId=${quiz.id}`)
                      }
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky transition-all duration-200 flex-shrink-0"
                    >
                      <Play className="w-4 h-4" />
                      ابدأ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddExamForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="modern-card w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    إضافة امتحان لمادة {normalizedSubjectName}
                  </h3>
                  <button
                    onClick={() => setShowAddExamForm(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      عنوان الامتحان
                    </label>
                    <input
                      value={examFormData.title}
                      onChange={(e) =>
                        setExamFormData((p) => ({
                          ...p,
                          title: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="مثال: امتحان نهائي 2024"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        القسم
                      </label>
                      <input
                        value={examFormData.department}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            department: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        placeholder="مثال: عام"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        السنة
                      </label>
                      <input
                        value={examFormData.year}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            year: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        placeholder="مثال: 2024"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        المدة (بالدقائق)
                      </label>
                      <input
                        value={examFormData.durationMinutes}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            durationMinutes: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        placeholder="مثال: 30"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        وصف (اختياري)
                      </label>
                      <input
                        value={examFormData.description}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        placeholder="مثال: أسئلة اختيار من متعدد"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        الأسئلة
                      </h4>
                      <button
                        onClick={() =>
                          setExamFormData((p) => ({
                            ...p,
                            questions: [
                              ...p.questions,
                              {
                                question: "",
                                options: ["", "", "", ""],
                                correctAnswer: 0,
                                explanation: "",
                              },
                            ],
                          }))
                        }
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة سؤال
                      </button>
                    </div>

                    <div className="space-y-4">
                      {examFormData.questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4"
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h5 className="font-bold text-slate-900 dark:text-white">
                              سؤال {idx + 1}
                            </h5>
                            {examFormData.questions.length > 1 && (
                              <button
                                onClick={() =>
                                  setExamFormData((p) => ({
                                    ...p,
                                    questions: p.questions.filter(
                                      (_, i) => i !== idx,
                                    ),
                                  }))
                                }
                                className="text-sm font-semibold text-red-600 hover:text-red-700"
                              >
                                حذف
                              </button>
                            )}
                          </div>

                          <input
                            value={q.question}
                            onChange={(e) =>
                              setExamFormData((p) => ({
                                ...p,
                                questions: p.questions.map((it, i) =>
                                  i === idx
                                    ? { ...it, question: e.target.value }
                                    : it,
                                ),
                              }))
                            }
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white mb-3"
                            placeholder="نص السؤال"
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            {q.options.map((opt, optIdx) => (
                              <input
                                key={optIdx}
                                value={opt}
                                onChange={(e) =>
                                  setExamFormData((p) => ({
                                    ...p,
                                    questions: p.questions.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            options: it.options.map((o, oi) =>
                                              oi === optIdx
                                                ? e.target.value
                                                : o,
                                            ),
                                          }
                                        : it,
                                    ),
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder={`اختيار ${optIdx + 1}`}
                              />
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                الإجابة الصحيحة
                              </label>
                              <select
                                value={q.correctAnswer}
                                onChange={(e) =>
                                  setExamFormData((p) => ({
                                    ...p,
                                    questions: p.questions.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            correctAnswer: Number(
                                              e.target.value,
                                            ),
                                          }
                                        : it,
                                    ),
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              >
                                <option value={0}>اختيار 1</option>
                                <option value={1}>اختيار 2</option>
                                <option value={2}>اختيار 3</option>
                                <option value={3}>اختيار 4</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                شرح (اختياري)
                              </label>
                              <input
                                value={q.explanation}
                                onChange={(e) =>
                                  setExamFormData((p) => ({
                                    ...p,
                                    questions: p.questions.map((it, i) =>
                                      i === idx
                                        ? { ...it, explanation: e.target.value }
                                        : it,
                                    ),
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder="شرح الإجابة"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowAddExamForm(false)}
                      className="px-5 py-3 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSaveExam}
                      disabled={
                        isSavingExam ||
                        !examFormData.title.trim() ||
                        !examFormData.department.trim() ||
                        !examFormData.year.trim() ||
                        examFormData.questions.some(
                          (q) =>
                            !q.question.trim() ||
                            q.options.some((o) => !o.trim()),
                        )
                      }
                      className="px-5 py-3 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-sky disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSavingExam ? "جاري الحفظ..." : "حفظ"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />
    </div>
  );
}

export default function SubjectSummariesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <SubjectSummariesContent />
    </Suspense>
  );
}
