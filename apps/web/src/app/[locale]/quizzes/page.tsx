"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { useRouter } from '@/navigation';
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/hooks/useSubjects";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import type { Quiz } from "@/types/database";
import { toast } from "sonner";
import { QuizDashboardHeader } from "@/components/quizzes/QuizDashboardHeader";
import { QuizDashboardFilters } from "@/components/quizzes/QuizDashboardFilters";
import { useQuizzesData } from "./_hooks/useQuizzesData";
import { useQuizzesFilters } from "./_hooks/useQuizzesFilters";
import { useQuizzesModals } from "./_hooks/useQuizzesModals";
import { useQuizFormState } from "./_hooks/useQuizFormState";
import { useQuizImport } from "./_hooks/useQuizImport";
import { QuizzesList } from "./_components/QuizzesList";
import { QuizzesEmptyState } from "./_components/QuizzesEmptyState";
import { PreviousExamsButton } from "./_components/PreviousExamsButton";
import { QuizzesLoading } from "./_components/QuizzesLoading";

const QuizImportModal = dynamic(
  () =>
    import("@/components/quizzes/QuizImportModal").then(
      (mod) => mod.QuizImportModal,
    ),
  {
    ssr: false,
  },
);

const QuizFormModal = dynamic(
  () =>
    import("@/components/quizzes/QuizFormModal").then(
      (mod) => mod.QuizFormModal,
    ),
  {
    ssr: false,
  },
);

const QuizDeleteDialog = dynamic(
  () =>
    import("./_components/QuizDeleteDialog").then(
      (mod) => mod.QuizDeleteDialog,
    ),
  {
    ssr: false,
  },
);

const getErrorMessage = (err: unknown): string | null => {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === "string" ? msg : null;
  }
  return null;
};

const getLevelNumber = (level: unknown): number | null => {
  if (!level || typeof level !== "object") return null;
  const raw = (level as Record<string, unknown>).level_number;
  return typeof raw === "number" ? raw : null;
};

// Use dynamic import with ssr: false for the main component to prevent hydration mismatches
const QuizDashboard = dynamic(() => Promise.resolve(QuizDashboardInternal), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

export default function QuizDashboardPage() {
  return <QuizDashboard />;
}

function QuizDashboardInternal() {
  const t = useTranslations("quizzes");
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { subjects: allSubjects, loading: subjectsLoading } = useSubjects();
  const { levels: academicLevels, getDepartmentsForLevelName } =
    useAcademicOptions();
  const {
    deleteDialogOpen,
    quizToDelete,
    isDeletingQuiz,
    setIsDeletingQuiz,
    showCreateForm,
    setShowCreateForm,
    showImportModal,
    setShowImportModal,
    importJson,
    setImportJson,
    importMode,
    setImportMode,
    isGenerating,
    setIsGenerating,
    editingQuiz,
    setEditingQuiz,
    openDeleteDialog,
    closeDeleteDialog,
    resetImportState,
  } = useQuizzesModals();

  const {
    formData,
    setFormData,
    resetForm,
    addQuestion,
    deleteQuestion,
    updateQuestion,
    updateOption,
    handleImageUpload,
    selectedFormSemesterNumber,
  } = useQuizFormState();

  const {
    quizzes,
    loading,
    loadQuizzes,
    summaries,
    saveQuiz,
    loadQuizForEdit,
    deleteQuiz,
  } = useQuizzesData({
    isAdmin,
    summarySubject: formData.subject,
    summaryDepartment: formData.department,
  });

  const { handleImport } = useQuizImport({
    importJson,
    formData,
    setFormData,
    resetImportState,
    setIsGenerating,
  });

  const {
    filters,
    setFilters,
    quizzesWithMeta,
    filterOptions,
    filteredQuizzes,
  } = useQuizzesFilters({
    quizzes,
    allSubjects,
    subjectsLoading,
    academicLevels,
    getDepartmentsForLevelName,
    user,
  });

  const selectedFormLevelNumber = useMemo(() => {
    if (!formData.year) return null;
    const found = academicLevels.find((l) => l.name === formData.year);
    return getLevelNumber(found);
  }, [academicLevels, formData.year]);

  const { subjects: filteredSubjectsForForm } = useSubjects({
    level: formData.year ? selectedFormLevelNumber : undefined,
    semester: selectedFormSemesterNumber,
  });

  const handleSaveQuiz = useCallback(async () => {
    try {
      if (!user) return;

      await saveQuiz({
        userId: user.id,
        formData,
        editingQuiz,
      });

      await loadQuizzes(true);
      toast.success(t("saveFeedback.success"), {
        description: editingQuiz
          ? t("saveFeedback.successEditDesc")
          : t("saveFeedback.successNewDesc"),
      });
      setShowCreateForm(false);
      setEditingQuiz(null);
      resetForm();
    } catch (error: unknown) {
      toast.error(t("saveFeedback.error"), {
        description:
          getErrorMessage(error) ||
          t("saveFeedback.errorDesc"),
      });
    }
  }, [user, saveQuiz, formData, loadQuizzes, editingQuiz, resetForm, t, setShowCreateForm, setEditingQuiz]);

  const handleEditQuiz = useCallback(async (quiz: Quiz) => {
    try {
      setEditingQuiz(quiz);
      setShowCreateForm(true);

      const result = await loadQuizForEdit(quiz);
      setFormData(result.formData);
    } catch (error: unknown) {
      setShowCreateForm(false);
      setEditingQuiz(null);
      toast.error(t("editFeedback.loadError"), {
        description:
          getErrorMessage(error) || t("editFeedback.loadErrorDesc"),
      });
    }
  }, [setEditingQuiz, setShowCreateForm, loadQuizForEdit, setFormData, t]);

  const handleDeleteQuiz = useCallback((quiz: Quiz) => {
    openDeleteDialog(quiz);
  }, [openDeleteDialog]);

  const handleConfirmDeleteQuiz = useCallback(async () => {
    if (!quizToDelete?.id) return;
    if (isDeletingQuiz) return;

    try {
      setIsDeletingQuiz(true);
      await deleteQuiz(quizToDelete.id);

      await loadQuizzes(true);
      toast.success(t("deleteFeedback.success"), {
        description: t("deleteFeedback.successDesc"),
      });
      closeDeleteDialog();
    } catch {
      toast.error(t("deleteFeedback.error"), {
        description: t("deleteFeedback.errorDesc"),
      });
    } finally {
      setIsDeletingQuiz(false);
    }
  }, [quizToDelete, isDeletingQuiz, setIsDeletingQuiz, deleteQuiz, loadQuizzes, t, closeDeleteDialog]);

  // Spec 036 Track D: stable nav handlers — the memoized QuizGridItem compares
  // these props on every dashboard render.
  const handlePlayQuiz = useCallback(
    (quiz: Quiz) => {
      router.push(`/quiz-play/${quiz.id}`);
    },
    [router],
  );

  const handleViewSummary = useCallback(
    (summaryId: string) => {
      router.push(`/summaries/${summaryId}`);
    },
    [router],
  );

  if (loading) {
    return <QuizzesLoading />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <QuizDashboardHeader
        isAdmin={isAdmin}
        t={t}
        onNewExam={() => setShowCreateForm(true)}
      />

      <QuizDashboardFilters
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        t={t}
      />

      {!isAdmin && <PreviousExamsButton t={t} />}

      {showImportModal && (
        <QuizImportModal
          importMode={importMode}
          setImportMode={setImportMode}
          importJson={importJson}
          setImportJson={setImportJson}
          isGenerating={isGenerating}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
          t={t}
        />
      )}

      {showCreateForm && (
        <QuizFormModal
          editingQuiz={editingQuiz}
          formData={formData}
          setFormData={setFormData}
          academicLevels={academicLevels}
          getDepartmentsForLevelName={getDepartmentsForLevelName}
          filteredSubjectsForForm={filteredSubjectsForForm}
          allSubjects={allSubjects}
          summaries={summaries}
          onAddQuestion={addQuestion}
          onDeleteQuestion={deleteQuestion}
          onUpdateQuestion={updateQuestion}
          onUpdateOption={updateOption}
          onImageUpload={handleImageUpload}
          onSave={handleSaveQuiz}
          onClose={() => {
            setShowCreateForm(false);
            setEditingQuiz(null);
            setFormData({
              title: "",
              description: "",
              durationMinutes: "",
              department: "",
              year: "",
              semester: "",
              subject: "",
              summaryId: "",
              questions: [
                {
                  question: "",
                  options: ["", "", "", ""],
                  correctAnswer: 0,
                  explanation: "",
                  type: "multiple-choice",
                  imageUrl: "",
                },
              ],
            });
          }}
          onOpenImport={() => setShowImportModal(true)}
        />
      )}

      <QuizzesList
        quizzes={filteredQuizzes}
        quizzesWithMeta={quizzesWithMeta}
        isAdmin={isAdmin}
        t={t}
        onPlay={handlePlayQuiz}
        onEdit={handleEditQuiz}
        onDelete={handleDeleteQuiz}
        onViewSummary={handleViewSummary}
      />

      {filteredQuizzes.length === 0 && <QuizzesEmptyState t={t} />}

      <QuizDeleteDialog
        open={deleteDialogOpen}
        quizTitle={quizToDelete?.title || ""}
        isDeleting={isDeletingQuiz}
        onCancel={closeDeleteDialog}
        onConfirm={handleConfirmDeleteQuiz}
      />
    </div>
  );
}
