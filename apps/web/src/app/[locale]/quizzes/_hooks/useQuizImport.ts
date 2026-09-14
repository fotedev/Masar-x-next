import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { aiAssistant } from "@/lib/ai-assistant";
import type { QuizFormData, QuizQuestionForm } from "../_types";

const toQuizQuestionForm = (q: unknown): QuizQuestionForm | null => {
  if (!q || typeof q !== "object") return null;
  const obj = q as Record<string, unknown>;
  const question = typeof obj.question === "string" ? obj.question : "";
  const options = Array.isArray(obj.options)
    ? (obj.options.filter((o) => typeof o === "string") as string[])
    : [];
  const correctAnswer =
    typeof obj.correctAnswer === "number" ? obj.correctAnswer : 0;
  const explanation = typeof obj.explanation === "string" ? obj.explanation : "";
  const typeRaw = typeof obj.type === "string" ? obj.type : "";
  const type: "multiple-choice" | "true-false" =
    typeRaw === "true-false" ? "true-false" : "multiple-choice";
  const imageUrl = typeof obj.imageUrl === "string" ? obj.imageUrl : "";

  if (!question.trim()) return null;
  if (options.length < 2) return null;
  if (correctAnswer < 0 || correctAnswer >= options.length) return null;

  return {
    question,
    options,
    correctAnswer,
    explanation,
    type,
    imageUrl,
  };
};

export function useQuizImport(args: {
  importJson: string;
  formData: QuizFormData;
  setFormData: Dispatch<SetStateAction<QuizFormData>>;
  resetImportState: () => void;
  setIsGenerating: (value: boolean) => void;
}) {
  const { importJson, formData, setFormData, resetImportState, setIsGenerating } =
    args;
  const t = useTranslations("quizzes");

  const handleImport = useCallback(
    async (mode: "json" | "text") => {
      if (mode === "json") {
        try {
          const questions = JSON.parse(importJson) as unknown;
          if (!Array.isArray(questions)) {
            toast.error(t("importFeedback.invalidJson"), {
              description: t("importFeedback.invalidJsonDesc"),
            });
            return;
          }

          const normalized = questions
            .map((q) => toQuizQuestionForm(q))
            .filter(Boolean) as QuizQuestionForm[];
          const isValid = normalized.length === questions.length;

          if (!isValid) {
            toast.error(t("importFeedback.invalidQuestions"), {
              description: t("importFeedback.invalidQuestionsDesc"),
            });
            return;
          }

          setFormData((prevFormData: QuizFormData) => ({
            ...prevFormData,
            questions: [...prevFormData.questions, ...normalized],
          }));
          resetImportState();
          toast.success(t("importFeedback.success"));
        } catch {
          toast.error(t("importFeedback.jsonParseError"), {
            description: t("importFeedback.jsonParseErrorDesc"),
          });
        }

        return;
      }

      if (mode === "text") {
        if (!importJson.trim()) return;

        try {
          setIsGenerating(true);
          const result = (await aiAssistant.generateQuiz(importJson)) as unknown;

          const resultObj =
            result && typeof result === "object"
              ? (result as Record<string, unknown>)
              : null;
          const resultQuestionsRaw = resultObj?.questions;
          const resultQuestions = Array.isArray(resultQuestionsRaw)
            ? (resultQuestionsRaw
                .map((q) => toQuizQuestionForm(q))
                .filter(Boolean) as QuizQuestionForm[])
            : null;
          const resultTitle = typeof resultObj?.title === "string" ? resultObj.title : "";

          if (resultQuestions) {
            setFormData({
              ...formData,
              title: resultTitle || formData.title,
              questions: resultQuestions,
            });
            resetImportState();
            toast.success(t("importFeedback.aiSuccess"));
          } else {
            throw new Error("Invalid format received from AI");
          }
        } catch {
          toast.error(t("importFeedback.aiError"), {
            description: t("importFeedback.aiErrorDesc"),
          });
        } finally {
          setIsGenerating(false);
        }
      }
    },
    [formData, importJson, resetImportState, setFormData, setIsGenerating, t],
  );

  return { handleImport };
}
