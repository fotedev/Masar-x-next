import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { QuizFormData, QuizQuestionForm } from "../_types";

const DEFAULT_QUESTION: QuizQuestionForm = {
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  type: "multiple-choice",
  imageUrl: "",
};

const EMPTY_FORM_DATA: QuizFormData = {
  title: "",
  description: "",
  durationMinutes: "",
  department: "",
  year: "",
  semester: "",
  subject: "",
  summaryId: "",
  questions: [DEFAULT_QUESTION],
};

export function useQuizFormState() {
  const t = useTranslations("quizzes");
  const [formData, setFormData] = useState<QuizFormData>(EMPTY_FORM_DATA);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
  }, []);

  const addQuestion = useCallback(() => {
    setFormData((prev: QuizFormData) => ({
      ...prev,
      questions: [...prev.questions, { ...DEFAULT_QUESTION }],
    }));
  }, []);

  const deleteQuestion = useCallback((index: number) => {
    setFormData((prev: QuizFormData) => {
      if (prev.questions.length <= 1) {
        toast.error(t("form.minQuestionsError"));
        return prev;
      }
      return {
        ...prev,
        questions: prev.questions.filter((_: QuizQuestionForm, i: number) => i !== index),
      };
    });
  }, [t]);

  const updateQuestion = useCallback(
    (index: number, field: string, value: unknown) => {
      setFormData((prev: QuizFormData) => {
        const updatedQuestions = [...prev.questions];
        const current = updatedQuestions[index];
        if (!current) return prev;

        if (field === "type") {
          if (value === "true-false") {
            updatedQuestions[index] = {
              ...current,
              type: "true-false",
              options: [t("form.trueOption"), t("form.falseOption")],
              correctAnswer: 0,
            };
          } else {
            updatedQuestions[index] = {
              ...current,
              type: "multiple-choice",
              options: ["", "", "", ""],
              correctAnswer: 0,
            };
          }
        } else {
          updatedQuestions[index] = {
            ...current,
            [field]: value,
          } as QuizQuestionForm;
        }

        return { ...prev, questions: updatedQuestions };
      });
    },
    [t],
  );

  const updateOption = useCallback(
    (questionIndex: number, optionIndex: number, value: string) => {
      setFormData((prev: QuizFormData) => {
        const updatedQuestions = [...prev.questions];
        const current = updatedQuestions[questionIndex];
        if (!current) return prev;

        const updatedOptions = [...current.options];
        updatedOptions[optionIndex] = value;

        updatedQuestions[questionIndex] = {
          ...current,
          options: updatedOptions,
        };

        return { ...prev, questions: updatedQuestions };
      });
    },
    [],
  );

  const handleImageUpload = useCallback(
    async (index: number, file: File) => {
      try {
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(t("form.imageTooLarge"), {
            description: t("form.imageTooLargeDesc", { name: file.name }),
          });
          return;
        }

        const result = await uploadToCloudinary(file, {
          folder: "quiz-images",
          resourceType: "image",
        });

        updateQuestion(index, "imageUrl", result.url);
      } catch (err) {
        toast.error(t("form.imageUploadError"), {
          description:
            err instanceof Error ? err.message : t("form.tryAgain"),
        });
      }
    },
    [updateQuestion, t],
  );

  const selectedFormYear = formData.year;
  const selectedFormSemester = formData.semester;

  const selectedFormSemesterNumber = useMemo(() => {
    if (!selectedFormYear) return undefined;
    if (!selectedFormSemester) return null;
    const n = Number(selectedFormSemester);
    return Number.isFinite(n) ? n : null;
  }, [selectedFormSemester, selectedFormYear]);

  return {
    formData,
    setFormData,
    resetForm,
    addQuestion,
    deleteQuestion,
    updateQuestion,
    updateOption,
    handleImageUpload,
    selectedFormSemesterNumber,
  };
}
