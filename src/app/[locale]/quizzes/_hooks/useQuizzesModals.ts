import { useEffect, useState } from "react";
import type { Quiz } from "@/types/database";

export function useQuizzesModals() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importMode, setImportMode] = useState<"json" | "text">("json");
  const [isGenerating, setIsGenerating] = useState(false);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    if (!deleteDialogOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isDeletingQuiz) return;
        setDeleteDialogOpen(false);
        setQuizToDelete(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteDialogOpen, isDeletingQuiz]);

  const openDeleteDialog = (quiz: Quiz) => {
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (isDeletingQuiz) return;
    setDeleteDialogOpen(false);
    setQuizToDelete(null);
  };

  const resetImportState = () => {
    setShowImportModal(false);
    setImportJson("");
    setImportMode("json");
  };

  const closeCreateFormAndResetEditing = () => {
    setShowCreateForm(false);
    setEditingQuiz(null);
  };

  return {
    deleteDialogOpen,
    quizToDelete,
    isDeletingQuiz,
    setDeleteDialogOpen,
    setQuizToDelete,
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
    closeCreateFormAndResetEditing,
  };
}
