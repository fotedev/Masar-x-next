"use client";

import { useState, useMemo, memo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Newspaper,
  Flag,
  BarChart3,
  Filter,
  X,
  Layout,
  GraduationCap,
  CreditCard,
  School,
} from "lucide-react";
import { useSummaries } from "@/hooks/useSummaries";
import { useSubjects } from "@/hooks/useSubjects";
import { useNews } from "@/hooks/useNews";
import { useAppeals } from "@/hooks/useAppeals";
import { useQuizzes } from "@/hooks/useQuizzes";
import { SummariesTab } from "@/components/SummariesTab";
import { NewsTab } from "@/components/NewsTab";
import { AppealsTab } from "@/components/AppealsTab";
import { QuizzesTab } from "@/components/QuizzesTab";
import { AddNewsModal } from "@/components/AddNewsModal";
import { EditSummaryModal } from "@/components/EditSummaryModal";
import { AdminAnalyticsPage } from "./AdminAnalyticsPage";
import { PageManagementTab } from "@/components/PageManagementTab";
import { CoursesTab } from "@/components/CoursesTab";
import { EnrollmentsTab } from "@/components/EnrollmentsTab";
import { AddCourseModal } from "@/components/AddCourseModal";
import { SubjectsTab } from "@/components/SubjectsTab";
import { AddSubjectModal } from "@/components/AddSubjectModal";
import { ManageLecturesModal } from "@/components/ManageLecturesModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { supabase } from "@/lib/supabase";
import type { SummaryWithRatings, Course } from "@/types/database";
import { usePathname } from "next/navigation";

// Memoized tab components to prevent unnecessary re-renders
const MemoizedSummariesTab = memo(SummariesTab);
const MemoizedNewsTab = memo(NewsTab);
const MemoizedAppealsTab = memo(AppealsTab);
const MemoizedQuizzesTab = memo(QuizzesTab);
const MemoizedPageManagementTab = memo(PageManagementTab);
const MemoizedAdminAnalyticsPage = memo(AdminAnalyticsPage);
const MemoizedCoursesTab = memo(CoursesTab);
const MemoizedEnrollmentsTab = memo(EnrollmentsTab);
const MemoizedSubjectsTab = memo(SubjectsTab);

function AdminDashboard() {
  const t = useTranslations("adminDashboard");
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, isAdminLoading, loading: authLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auth guard: redirect non-admin users
  const isAuthChecking = authLoading || isAdminLoading;

  useEffect(() => {
    if (isMounted && !isAuthChecking && (!user || !isAdmin)) {
      const isEn = pathname?.startsWith("/en");
      router.replace(isEn ? "/en" : "/");
    }
  }, [user, isAdmin, isAuthChecking, router, pathname, isMounted]);

  if (!isMounted || isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t("auth.checking")}
          </p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            {t("auth.unauthorized")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t("auth.noPermission")}
          </p>
        </div>
      </div>
    );
  }

  return <AdminDashboardContent />;
}

function AdminDashboardContent() {
  const t = useTranslations("adminDashboard");
  const router = useRouter();
  const { adminRole } = useAuth();
  const { activeSemester } = usePlatformSettings();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [coursesRefreshKey, setCoursesRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(
    adminRole === "doctor" ? "courses" : "summaries",
  );
  const [globalFilters, setGlobalFilters] = useState({
    subject: "",
    department: "",
    year: "",
  });

  const availableDepartments = useMemo(() => {
    if (!globalFilters.year) return [];
    return getDepartmentsForLevelName(globalFilters.year);
  }, [getDepartmentsForLevelName, globalFilters.year]);
  const newsHook = useNews({ includeInactive: true });
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [showManageLectures, setShowManageLectures] = useState(false);
  const [selectedSubjectForLectures, setSelectedSubjectForLectures] =
    useState<string>("");

  const summariesHook = useSummaries();
  const subjectsHook = useSubjects();
  const appealsHook = useAppeals();
  const quizzesHook = useQuizzes();

  useEffect(() => {
    if (globalFilters.year || !activeSemester) return;
    const idx = activeSemester - 1;
    const defaultLevel = levels[idx]?.name;
    if (defaultLevel) {
      setGlobalFilters((prev) => ({ ...prev, year: defaultLevel }));
    }
  }, [activeSemester, globalFilters.year, levels]);

  // Apply global filters to all data
  const filteredSummaries = useMemo(() => {
    return summariesHook.summaries.filter((s) => {
      const matchSubject =
        !globalFilters.subject || s.subject === globalFilters.subject;
      const matchDepartment =
        !globalFilters.department || s.department === globalFilters.department;
      const matchYear = !globalFilters.year || s.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [summariesHook.summaries, globalFilters]);

  const filteredNews = useMemo(() => {
    return newsHook.news.filter((n) => {
      const matchSubject =
        !globalFilters.subject || n.subject === globalFilters.subject;
      const matchDepartment =
        !globalFilters.department || n.department === globalFilters.department;
      const matchYear = !globalFilters.year || n.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [newsHook.news, globalFilters]);

  const filteredQuizzes = useMemo(() => {
    return quizzesHook.quizzes.filter((q) => {
      const matchSubject =
        !globalFilters.subject || q.subject === globalFilters.subject;
      const matchDepartment =
        !globalFilters.department || q.department === globalFilters.department;
      const matchYear = !globalFilters.year || q.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [quizzesHook.quizzes, globalFilters]);

  const filteredAppeals = useMemo(() => {
    return appealsHook.appeals.filter((a) => {
      let content: {
        subject?: string | null;
        department?: string | null;
        year?: string | null;
      } | null = null;
      if (a.content_type === "summary") {
        content =
          summariesHook.summaries.find((s) => s.id === a.content_id) || null;
      } else if (a.content_type === "news") {
        const foundNews = newsHook.news.find((n) => n.id === a.content_id);
        content = foundNews
          ? {
              subject: foundNews.subject,
              department: foundNews.department,
              year: foundNews.year,
            }
          : null;
      }

      if (content) {
        const matchSubject =
          !globalFilters.subject || content.subject === globalFilters.subject;
        const matchDepartment =
          !globalFilters.department ||
          content.department === globalFilters.department;
        const matchYear =
          !globalFilters.year || content.year === globalFilters.year;
        return matchSubject && matchDepartment && matchYear;
      }

      return (
        !globalFilters.subject &&
        !globalFilters.department &&
        !globalFilters.year
      );
    });
  }, [
    appealsHook.appeals,
    summariesHook.summaries,
    newsHook.news,
    globalFilters,
  ]);

  const isLoading = useMemo(
    () =>
      summariesHook.loading ||
      newsHook.loading ||
      appealsHook.loading ||
      quizzesHook.loading,
    [
      summariesHook.loading,
      newsHook.loading,
      appealsHook.loading,
      quizzesHook.loading,
    ],
  );

  const handleUpdateSummaryStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    const oldSummary = summariesHook.summaries.find((s) => s.id === id);
    await summariesHook.updateStatus(id, status);

    if (status === "approved" && oldSummary) {
      // notifyAllUsers logic would go here if needed
    }
  };

  const handleCreateCourse = () => {
    setEditingCourse(null);
    setShowAddCourse(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowAddCourse(true);
  };

  const handleSaveCourse = () => {
    // Courses tab will refresh automatically
    setShowAddCourse(false);
    setEditingCourse(null);
    setCoursesRefreshKey((prev) => prev + 1);
  };

  const handleCreateSubject = () => {
    setEditingSubject(null);
    setShowAddSubject(true);
  };

  const handleEditSubject = (subject: any) => {
    setEditingSubject(subject);
    setShowAddSubject(true);
  };

  const handleManageLectures = (subject: any) => {
    setSelectedSubjectForLectures(subject.name);
    setShowManageLectures(true);
  };

  const handleSaveSubject = async (subjectData: any) => {
    try {
      // Clean up the data before sending to Supabase
      const { id, created_at, ...cleanData } = subjectData;

      if (editingSubject) {
        const { error } = await supabase
          .from("subjects")
          .update(cleanData)
          .eq("id", editingSubject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert([cleanData]);
        if (error) throw error;
      }
      subjectsHook.fetchSubjects(true);
      setShowAddSubject(false);
      setEditingSubject(null);
    } catch (error) {
      console.error("Error saving subject:", error);
      throw error;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "courses":
        return adminRole === "doctor" ? (
          <MemoizedCoursesTab
            onCreateCourse={handleCreateCourse}
            onEditCourse={(course: unknown) =>
              handleEditCourse(course as Course)
            }
            refreshKey={coursesRefreshKey}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {t("noAccess.courses")}
          </div>
        );
      case "subjects":
        return (
          <MemoizedSubjectsTab
            subjects={subjectsHook.subjects}
            onRefresh={() => subjectsHook.fetchSubjects(true)}
            onEdit={handleEditSubject}
            onAdd={handleCreateSubject}
            onManageLectures={handleManageLectures}
          />
        );
      case "summaries":
        return (
          <MemoizedSummariesTab
            summaries={filteredSummaries}
            onUpdateStatus={handleUpdateSummaryStatus}
            onDeleteSummary={summariesHook.deleteSummary}
            onEditSummary={handleEditSummary}
            onClearAllSummaries={summariesHook.clearAllSummaries}
          />
        );
      case "news":
        return (
          <MemoizedNewsTab
            news={filteredNews}
            onToggleStatus={newsHook.toggleNewsStatus}
            onSetShowAddNews={newsHook.setShowAddNews}
            onDeleteNews={newsHook.deleteNews}
          />
        );
      case "appeals":
        return (
          <MemoizedAppealsTab
            appeals={filteredAppeals}
            onAcceptAppeal={appealsHook.acceptAppeal}
            onRejectAppeal={appealsHook.rejectAppeal}
            onDeleteAppeal={appealsHook.deleteAppeal}
          />
        );
      case "quizzes":
        return (
          <MemoizedQuizzesTab
            quizzes={filteredQuizzes}
            onDeleteQuiz={quizzesHook.deleteQuiz}
            onUpdateStatus={quizzesHook.updateStatus}
          />
        );
      case "enrollments":
        return adminRole === "doctor" ? (
          <MemoizedEnrollmentsTab />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {t("noAccess.enrollments")}
          </div>
        );
      case "analytics":
        return (
          <MemoizedAdminAnalyticsPage
            onNavigate={(page) =>
              router.push(page === "home" ? "/" : `/${page}`)
            }
          />
        );
      case "page_management":
        return adminRole === "doctor" ? (
          <MemoizedPageManagementTab />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {t("noAccess.pageManagement")}
          </div>
        );
      default:
        return null;
    }
  };

  const [editingSummary, setEditingSummary] =
    useState<SummaryWithRatings | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEditSummary = (summary: SummaryWithRatings) => {
    setEditingSummary(summary);
    setShowEditModal(true);
  };

  const handleSaveSummary = async (
    id: string,
    updates: Partial<SummaryWithRatings>,
  ) => {
    await summariesHook.editSummary(id, updates);
    setShowEditModal(false);
    setEditingSummary(null);
  };

  if (isLoading || !isMounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t("title")}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
              <Filter className="w-4 h-4" />
              <span>{t("globalFilter")}</span>
            </div>

            <select
              value={globalFilters.year}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  year: e.target.value,
                  department: "",
                }))
              }
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t("allLevels")}</option>
              {levels.map((level) => (
                <option key={level.id} value={level.name}>
                  {level.name}
                </option>
              ))}
            </select>

            <select
              value={globalFilters.department}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
              disabled={
                !globalFilters.year || availableDepartments.length === 0
              }
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t("allDepartments")}</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              value={globalFilters.subject}
              onChange={(e) =>
                setGlobalFilters((prev) => ({
                  ...prev,
                  subject: e.target.value,
                }))
              }
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t("allSubjects")}</option>
              {[...new Set(subjectsHook.subjects.map((s) => s.name))]
                .sort()
                .map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
            </select>

            {(globalFilters.subject ||
              globalFilters.department ||
              globalFilters.year) && (
              <button
                onClick={() =>
                  setGlobalFilters({ subject: "", department: "", year: "" })
                }
                className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                title={t("clearFilters")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 scroll-x-mobile">
          {adminRole === "doctor" && (
            <button
              onClick={() => setActiveTab("courses")}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "courses"
                  ? "border-green-500 text-green-600 dark:text-green-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              {t("tabs.courses")}
            </button>
          )}
          <button
            onClick={() => setActiveTab("subjects")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "subjects"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <School className="w-4 h-4" />
            {t("tabs.subjects")}
          </button>
          {adminRole === "doctor" && (
            <button
              onClick={() => setActiveTab("enrollments")}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "enrollments"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {t("tabs.enrollments")}
            </button>
          )}
          <button
            onClick={() => setActiveTab("summaries")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "summaries"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {t("tabs.summaries")}
          </button>
          <button
            onClick={() => setActiveTab("news")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "news"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <Newspaper className="w-4 h-4" />
            {t("tabs.news")}
          </button>
          <button
            onClick={() => setActiveTab("appeals")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "appeals"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <Flag className="w-4 h-4" />
            {t("tabs.appeals")}
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "quizzes"
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {t("tabs.quizzes")}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "analytics"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t("tabs.analytics")}
          </button>
          {adminRole === "doctor" && (
            <button
              onClick={() => setActiveTab("page_management")}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "page_management"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Layout className="w-4 h-4" />
              {t("tabs.pageManagement")}
            </button>
          )}
        </div>

        {renderTabContent()}
      </div>

      <AddNewsModal
        showAddNews={newsHook.showAddNews}
        newNews={newsHook.newNews}
        onSetShowAddNews={newsHook.setShowAddNews}
        onSetNewNews={newsHook.setNewNews}
        onAddNews={(newsData, fileUrl, imageUrls, customCategory) =>
          newsHook.addNews(
            newsData,
            fileUrl,
            imageUrls,
            customCategory,
            globalFilters.subject || null,
            globalFilters.department || null,
            globalFilters.year || null,
          )
        }
      />

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />

      <AddCourseModal
        showAddCourse={showAddCourse}
        editingCourse={editingCourse}
        onClose={() => {
          setShowAddCourse(false);
          setEditingCourse(null);
        }}
        onSave={handleSaveCourse}
      />

      <AddSubjectModal
        show={showAddSubject}
        editingSubject={editingSubject}
        onClose={() => {
          setShowAddSubject(false);
          setEditingSubject(null);
        }}
        onSave={handleSaveSubject}
      />

      <ManageLecturesModal
        show={showManageLectures}
        subjectName={selectedSubjectForLectures}
        onClose={() => {
          setShowManageLectures(false);
          setSelectedSubjectForLectures("");
        }}
      />
    </div>
  );
}

export default AdminDashboard;
