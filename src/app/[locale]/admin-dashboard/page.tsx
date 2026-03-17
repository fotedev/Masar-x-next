"use client";

import { useState, useMemo, memo, useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useAdminFilters } from "@/hooks/useAdminFilters";
import { AdminDashboardHeader } from "@/components/admin/AdminDashboardHeader";
import { AdminDashboardTabs } from "@/components/admin/AdminDashboardTabs";
import type { SummaryWithRatings } from "@/types/database";
import { usePathname } from "next/navigation";

type CoursesTabCourse = Parameters<
  NonNullable<ComponentProps<typeof CoursesTab>["onEditCourse"]>
>[0];

type SubjectsTabSubject = Parameters<
  NonNullable<ComponentProps<typeof SubjectsTab>["onEdit"]>
>[0];

type EditingSubject = NonNullable<
  ComponentProps<typeof AddSubjectModal>["editingSubject"]
>;

type SubjectInsert = Parameters<
  ComponentProps<typeof AddSubjectModal>["onSave"]
>[0] & { created_at?: string | null };

type EditingCourse = {
  id: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  is_academic?: boolean | null;
};

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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState(
    adminRole === "doctor" ? "courses" : "summaries",
  );

  const newsHook = useNews({ includeInactive: true });
  const summariesHook = useSummaries();
  const subjectsHook = useSubjects();
  const appealsHook = useAppeals();
  const quizzesHook = useQuizzes();

  const {
    globalFilters,
    setGlobalFilters,
    availableDepartments,
    filteredSummaries,
    filteredNews,
    filteredQuizzes,
    filteredAppeals,
    clearFilters,
    levels,
  } = useAdminFilters({
    summaries: summariesHook.summaries as SummaryWithRatings[],
    news: newsHook.news,
    quizzes: quizzesHook.quizzes,
    appeals: appealsHook.appeals,
  });

  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<EditingCourse | null>(
    null,
  );
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<EditingSubject | null>(
    null,
  );
  const [showManageLectures, setShowManageLectures] = useState(false);
  const [selectedSubjectForLectures, setSelectedSubjectForLectures] =
    useState<string>("");

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
    const oldSummary = (summariesHook.summaries as SummaryWithRatings[]).find(
      (s: SummaryWithRatings) => s.id === id,
    );
    await summariesHook.updateStatus(id, status);

    if (status === "approved" && oldSummary) {
      // notifyAllUsers logic would go here if needed
    }
  };

  const handleCreateCourse = () => {
    setEditingCourse(null);
    setShowAddCourse(true);
  };

  const handleEditCourse = (course: CoursesTabCourse) => {
    setEditingCourse({
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price,
    });
    setShowAddCourse(true);
  };

  const handleSaveCourse = () => {
    // Courses tab will refresh automatically via TanStack Query invalidation
    setShowAddCourse(false);
    setEditingCourse(null);
  };

  const handleCreateSubject = () => {
    setEditingSubject(null);
    setShowAddSubject(true);
  };

  const handleEditSubject = (subject: SubjectsTabSubject) => {
    setEditingSubject(subject as EditingSubject);
    setShowAddSubject(true);
  };

  const handleManageLectures = (subject: SubjectsTabSubject) => {
    setSelectedSubjectForLectures(subject.name);
    setShowManageLectures(true);
  };

  const handleSaveSubject = async (subjectData: SubjectInsert) => {
    try {
      const cleanData: Record<string, unknown> = { ...subjectData };
      delete cleanData.id;
      delete cleanData.created_at;

      if (editingSubject) {
        await subjectsHook.updateSubject(editingSubject.id, cleanData);
      } else {
        await subjectsHook.createSubject(cleanData);
      }
      setShowAddSubject(false);
      setEditingSubject(null);
    } catch (error) {
      throw error;
    }
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
            {t("noAccess.courses")}
          </div>
        );
      case "subjects":
        return (
          <MemoizedSubjectsTab
            subjects={subjectsHook.subjects}
            onRefresh={() => subjectsHook.fetchSubjects()}
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
      <AdminDashboardHeader
        globalFilters={globalFilters}
        setGlobalFilters={setGlobalFilters}
        levels={levels}
        availableDepartments={availableDepartments}
        subjects={subjectsHook.subjects}
        onClearFilters={clearFilters}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <AdminDashboardTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          adminRole={adminRole}
        />

        {renderTabContent()}
      </div>

      <AddNewsModal
        showAddNews={newsHook.showAddNews}
        newNews={newsHook.newNews}
        onSetShowAddNews={newsHook.setShowAddNews}
        onSetNewNews={newsHook.setNewNews}
        onAddNews={(newsData, fileUrl, imageUrls, customCategory) =>
          newsHook.addNews(
            {
              ...newsData,
              subject: globalFilters.subject || newsData.subject,
              department: globalFilters.department || newsData.department,
              year: globalFilters.year || newsData.year,
            },
            fileUrl,
            imageUrls,
            customCategory,
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
