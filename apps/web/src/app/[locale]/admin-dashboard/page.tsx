"use client";

import { useState, useMemo, memo, useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSummaries } from "@/hooks/useSummaries";
import { useSubjects } from "@/hooks/useSubjects";
import { useNews } from "@/hooks/useNews";
import { useAppeals } from "@/hooks/useAppeals";
import { useQuizzes } from "@/hooks/useQuizzes";
import { NewsTab } from "@/components/NewsTab";
import { AppealsTab } from "@/components/AppealsTab";
import { QuizzesTab } from "@/components/QuizzesTab";
import { AddNewsModal } from "@/components/AddNewsModal";
import { AdminAnalyticsPage } from "./AdminAnalyticsPage";
import { PageManagementTab } from "@/components/PageManagementTab";
import {
  CoursesEnrollmentsView,
  type CoursesTabCourse,
} from "@/components/admin/CoursesEnrollmentsView";
import { AddCourseModal } from "@/components/AddCourseModal";
import { SubjectsTab } from "@/components/SubjectsTab";
import { AddSubjectModal } from "@/components/AddSubjectModal";
import { ManageLecturesModal } from "@/components/ManageLecturesModal";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminFilters } from "@/hooks/useAdminFilters";
import { AdminDashboardHeader } from "@/components/admin/AdminDashboardHeader";
import { AdminLayout } from "@/components/admin-shell/AdminLayout";
import { AdminOverviewTab } from "@/components/admin-shell/AdminOverviewTab";
import type { AdminTabId } from "@/lib/admin-shell/navigation";
import type { SummaryWithRatings } from "@/types/database";
import { usePathname } from "next/navigation";

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
const MemoizedNewsTab = memo(NewsTab);
const MemoizedAppealsTab = memo(AppealsTab);
const MemoizedQuizzesTab = memo(QuizzesTab);
const MemoizedPageManagementTab = memo(PageManagementTab);
const MemoizedAdminAnalyticsPage = memo(AdminAnalyticsPage);
const MemoizedSubjectsTab = memo(SubjectsTab);

function AdminDashboard() {
  const t = useTranslations("adminDashboard");
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const isAdminLoading = false; // AuthContext handles admin state within the main loading state
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
      <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
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
      <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
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
  const { user } = useAuth();
  const adminRole = user?.app_metadata?.role;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  const newsHook = useNews({ includeInactive: true });
  // Read-only summaries fetch: appeals filtering joins appeal content_id to
  // summaries for subject/department/year context. Summaries management is
  // retired (spec 006) — nothing below renders or mutates summaries.
  const summariesHook = useSummaries();
  const subjectsHook = useSubjects();
  const appealsHook = useAppeals();
  const quizzesHook = useQuizzes();

  const {
    globalFilters,
    setGlobalFilters,
    availableDepartments,
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
      case "overview":
        return (
          <>
            <AdminOverviewTab
              subjects={subjectsHook.subjects}
              news={newsHook.news}
              quizzes={quizzesHook.quizzes}
              appealsCount={appealsHook.appeals.length}
              onNavigate={(tab) => setActiveTab(tab)}
              onAddNew={() => newsHook.setShowAddNews(true)}
              onAddSubject={handleCreateSubject}
            />
            {/* Usage analytics (RPC) composed into the same landing view;
                the delegate pass unifies both under one StatCard grid. */}
            <MemoizedAdminAnalyticsPage
              onNavigate={(page) =>
                router.push(page === "home" ? "/" : `/${page}`)
              }
            />
          </>
        );
      case "courses_enrollments":
        return adminRole === "doctor" ? (
          <CoursesEnrollmentsView
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

  if (isLoading || !isMounted) {
    return (
      <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isMounted) return null;

  return (
    <AdminLayout
      activeTab={activeTab as AdminTabId}
      onSelectTab={(id) => setActiveTab(id)}
      adminRole={adminRole}
      sectionLabel={t(
        activeTab === "page_management"
          ? "tabs.pageManagement"
          : activeTab === "courses_enrollments"
            ? "tabs.coursesEnrollments"
            : `tabs.${activeTab}`,
      )}
      onAddNew={() => newsHook.setShowAddNews(true)}
    >
    <div className="space-y-6">
      {activeTab !== "overview" ? (
        <AdminDashboardHeader
          globalFilters={globalFilters}
          setGlobalFilters={setGlobalFilters}
          levels={levels}
          availableDepartments={availableDepartments}
          subjects={subjectsHook.subjects}
          onClearFilters={clearFilters}
        />
      ) : null}

      {activeTab === "overview" ? (
        renderTabContent()
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          {renderTabContent()}
        </div>
      )}

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
    </AdminLayout>
  );
}

export default AdminDashboard;
