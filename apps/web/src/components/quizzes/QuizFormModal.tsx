import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import { QuizMetaFields } from "./quiz-form/QuizMetaFields";
import { QuizQuestionsSection } from "./quiz-form/QuizQuestionsSection";
import type {
  AcademicLevelOption,
  DepartmentOption,
  QuizFormData,
  QuizQuestion,
  SubjectOption,
  SummaryOption,
} from "./quiz-form/types";

interface QuizFormModalProps {
  editingQuiz: { id: string } | null;
  formData: QuizFormData;
  setFormData: Dispatch<SetStateAction<QuizFormData>>;
  academicLevels: AcademicLevelOption[];
  getDepartmentsForLevelName: (level: string) => DepartmentOption[];
  filteredSubjectsForForm: SubjectOption[];
  allSubjects: SubjectOption[];
  summaries: SummaryOption[];
  onAddQuestion: () => void;
  onDeleteQuestion: (index: number) => void;
  onUpdateQuestion: (
    index: number,
    field: keyof QuizQuestion,
    value: unknown,
  ) => void;
  onUpdateOption: (qIndex: number, oIndex: number, value: string) => void;
  onImageUpload: (index: number, file: File) => void;
  onSave: () => void;
  onClose: () => void;
  onOpenImport: () => void;
}

export function QuizFormModal({
  editingQuiz,
  formData,
  setFormData,
  academicLevels,
  getDepartmentsForLevelName,
  filteredSubjectsForForm,
  allSubjects,
  summaries,
  onAddQuestion,
  onDeleteQuestion,
  onUpdateQuestion,
  onUpdateOption,
  onImageUpload,
  onSave,
  onClose,
  onOpenImport,
}: QuizFormModalProps) {
  const t = useTranslations("quizzes");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    setHighlighted(true);
    const timer = setTimeout(() => setHighlighted(false), 1600);
    // The form sits above the grid in normal flow — without this the user
    // clicks Edit and nothing visibly happens while the form mounts off-screen.
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => clearTimeout(timer);
    // Re-run on target change so editing another exam while the form is open
    // re-scrolls and re-highlights.
  }, [editingQuiz?.id]);

  return (
    <div
      ref={panelRef}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-xs p-6 mb-8 scroll-mt-24 transition-shadow duration-700 ${highlighted ? "ring-2 ring-blue-500" : ""}`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="space-y-6" dir="auto">
        <QuizMetaFields
          editingQuiz={editingQuiz}
          formData={formData}
          setFormData={setFormData}
          academicLevels={academicLevels}
          getDepartmentsForLevelName={getDepartmentsForLevelName}
          filteredSubjectsForForm={filteredSubjectsForForm}
          allSubjects={allSubjects}
          summaries={summaries}
          onOpenImport={onOpenImport}
        />

        <QuizQuestionsSection
          questions={formData.questions}
          onAddQuestion={onAddQuestion}
          onDeleteQuestion={onDeleteQuestion}
          onUpdateQuestion={onUpdateQuestion}
          onUpdateOption={onUpdateOption}
          onImageUpload={onImageUpload}
        />

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {commonT("cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={
              !formData.title.trim() ||
              !formData.department ||
              !formData.year ||
              !formData.subject.trim() ||
              formData.questions.some((q) => !q.question.trim())
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {editingQuiz ? t("updateQuiz") : t("createQuiz")}
          </button>
        </div>
      </div>
    </div>
  );
}
