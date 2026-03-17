import { useCallback, useMemo, useState } from "react";
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
        toast.error("يجب أن يحتوي الامتحان على سؤال واحد على الأقل");
        return prev;
      }
      return {
        ...prev,
        questions: prev.questions.filter((_: QuizQuestionForm, i: number) => i !== index),
      };
    });
  }, []);

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
              options: ["صح", "خطأ"],
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
    [],
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
          toast.error("حجم الصورة كبير جداً", {
            description: `حجم الصورة "${file.name}" يتجاوز الحد المسموح به (5MB)`,
          });
          return;
        }

        const result = await uploadToCloudinary(file, {
          folder: "quiz-images",
          resourceType: "image",
        });

        updateQuestion(index, "imageUrl", result.url);
      } catch (err) {
        toast.error("حدث خطأ أثناء رفع الصورة", {
          description:
            err instanceof Error ? err.message : "يرجى المحاولة مرة أخرى.",
        });
      }
    },
    [updateQuestion],
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
