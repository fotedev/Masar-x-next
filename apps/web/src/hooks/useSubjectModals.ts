import { useState } from "react";
import { Summary } from "@/types/database";

export function useSubjectModals() {
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddLectureForm, setShowAddLectureForm] = useState(false);
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [showAddExamForm, setShowAddExamForm] = useState(false);

  const [lectureFormData, setLectureFormData] = useState({
    title: "",
    label: "",
    key: "",
    orderIndex: "",
  });

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

  return {
    editingSummary,
    setEditingSummary,
    showEditModal,
    setShowEditModal,
    showAddLectureForm,
    setShowAddLectureForm,
    showEditSubjectModal,
    setShowEditSubjectModal,
    showAddExamForm,
    setShowAddExamForm,
    lectureFormData,
    setLectureFormData,
    examFormData,
    setExamFormData,
  };
}
