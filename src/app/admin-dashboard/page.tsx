'use client';

import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useSummaries } from "../../hooks/useSummaries";
import { useNews } from "../../hooks/useNews";
import { useAppeals } from "../../hooks/useAppeals";
import { useQuizzes } from "../../hooks/useQuizzes";
import { SummariesTab } from "../../components/SummariesTab";
import { NewsTab } from "../../components/NewsTab";
import { AppealsTab } from "../../components/AppealsTab";
import { QuizzesTab } from "../../components/QuizzesTab";
import { AddNewsModal } from "../../components/AddNewsModal";
import { EditSummaryModal } from "../../components/EditSummaryModal";
import { AdminAnalyticsPage } from "./AdminAnalyticsPage";
import { PageManagementTab } from "../../components/PageManagementTab";
import { CoursesTab } from "../../components/CoursesTab";
import { EnrollmentsTab } from "../../components/EnrollmentsTab";
import { AddCourseModal } from "../../components/AddCourseModal";
import { ACADEMIC_LEVELS, DEPARTMENTS } from "../../constants/academic";
import { useAuth } from "../../contexts/AuthContext";
import type { SummaryWithRatings } from "../../types/database";

// Memoized tab components to prevent unnecessary re-renders
const MemoizedSummariesTab = memo(SummariesTab);
const MemoizedNewsTab = memo(NewsTab);
const MemoizedAppealsTab = memo(AppealsTab);
const MemoizedQuizzesTab = memo(QuizzesTab);
const MemoizedPageManagementTab = memo(PageManagementTab);
const MemoizedAdminAnalyticsPage = memo(AdminAnalyticsPage);
const MemoizedCoursesTab = memo(CoursesTab);
const MemoizedEnrollmentsTab = memo(EnrollmentsTab);

function AdminDashboard() {
  const router = useRouter();
  const { adminRole } = useAuth();
  const [activeTab, setActiveTab] = useState(adminRole === "doctor" ? "courses" : "summaries");
  const [globalFilters, setGlobalFilters] = useState({
    subject: "",
    department: "",
    year: "",
  });
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);

  const summariesHook = useSummaries();
  const newsHook = useNews();
  const appealsHook = useAppeals();
  const quizzesHook = useQuizzes();

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
      let content: any = null;
      if (a.content_type === "summary") {
        content = summariesHook.summaries.find((s) => s.id === a.content_id);
      } else if (a.content_type === "news") {
        content = newsHook.news.find((n) => n.id === a.content_id);
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
    ]
  );

  const handleUpdateSummaryStatus = async (
    id: string,
    status: "approved" | "rejected"
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

  const handleEditCourse = (course: any) => {
    setEditingCourse(course);
    setShowAddCourse(true);
  };

  const handleSaveCourse = () => {
    // Courses tab will refresh automatically
    setShowAddCourse(false);
    setEditingCourse(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "courses":
        return adminRole === "doctor" ? (
          <MemoizedCoursesTab
            onCreateCourse={handleCreateCourse}
            onEditCourse={handleEditCourse}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            ليس لديك صلاحية الوصول لإدارة الكورسات
          </div>
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
            ليس لديك صلاحية الوصول لإثباتات الدفع
          </div>
        );
      case "analytics":
        return (
          <MemoizedAdminAnalyticsPage
            onNavigate={(page) => router.push(page === "home" ? "/" : `/${page}`)}
          />
        );
      case "page_management":
        return adminRole === "doctor" ? (
          <MemoizedPageManagementTab />
        ) : (
          <div className="p-8 text-center text-gray-500">
            ليس لديك صلاحية الوصول لإدارة الصفحة
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

  const handleSaveSummary = async (id: string, updates: any) => {
    await summariesHook.editSummary(id, updates);
    setShowEditModal(false);
    setEditingSummary(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              لوحة تحكم المشرفين
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              إدارة ومراجعة المحتوى والأخبار والامتحانات
            </p>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
              <Filter className="w-4 h-4" />
              <span>فلتر شامل:</span>
            </div>

            <select
              value={globalFilters.year}
              onChange={(e) =>
                setGlobalFilters((prev) => ({ ...prev, year: e.target.value }))
              }
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="">كل المستويات</option>
              {ACADEMIC_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
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
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="">كل الأقسام</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
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
              <option value="">كل المواد</option>
              {[...new Set(summariesHook.summaries.map((s) => s.subject))]
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
                title="مسح الفلاتر"
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
              الكورسات
            </button>
          )}
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
              إثباتات الدفع
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
            الملخصات
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
            الأخبار
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
            الطعون
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
            الامتحانات
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
            التحليلات
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
              إدارة الصفحة
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
            globalFilters.year || null
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
    </div>
  );
}

export default AdminDashboard;
