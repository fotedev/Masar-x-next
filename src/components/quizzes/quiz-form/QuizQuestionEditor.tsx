import React from "react";
import Image from "next/image";
import { Sparkles, Trash2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { LatexRenderer } from "@/components/LatexRenderer";
import type { QuizQuestion } from "./types";

export function QuizQuestionEditor(props: {
  question: QuizQuestion;
  questionIndex: number;
  onDeleteQuestion: (index: number) => void;
  onUpdateQuestion: (
    index: number,
    field: keyof QuizQuestion,
    value: unknown,
  ) => void;
  onUpdateOption: (qIndex: number, oIndex: number, value: string) => void;
  onImageUpload: (index: number, file: File) => void;
}) {
  const {
    question,
    questionIndex,
    onDeleteQuestion,
    onUpdateQuestion,
    onUpdateOption,
    onImageUpload,
  } = props;

  const t = useTranslations("quizzes");

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("questionIndex", { number: questionIndex + 1 })}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={question.type}
              onChange={(e) =>
                onUpdateQuestion(questionIndex, "type", e.target.value)
              }
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="multiple-choice">{t("multipleChoice")}</option>
              <option value="true-false">{t("trueFalse")}</option>
            </select>
            <button
              onClick={() => onDeleteQuestion(questionIndex)}
              className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t("deleteQuestion")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={question.question}
          onChange={(e) =>
            onUpdateQuestion(questionIndex, "question", e.target.value)
          }
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white mb-2"
          placeholder={t("questionPlaceholder")}
        />
        {question.question && (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600/30">
            <div className="font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>{t("questionPreview")}:</span>
            </div>
            <LatexRenderer
              text={question.question}
              className="text-base text-gray-800 dark:text-gray-200"
            />
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("questionImage")}
        </label>
        <div className="flex items-start gap-4">
          {question.imageUrl ? (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
              <Image
                src={question.imageUrl}
                alt="Question"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => onUpdateQuestion(questionIndex, "imageUrl", "")}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                title={t("removeImage")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("uploadImage")}
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImageUpload(questionIndex, file);
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("options")}
        </label>
        {question.type === "true-false" ? (
          <div className="flex gap-4">
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  question.correctAnswer === optionIndex
                    ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
                    : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name={`correct-${questionIndex}`}
                  checked={question.correctAnswer === optionIndex}
                  onChange={() =>
                    onUpdateQuestion(questionIndex, "correctAnswer", optionIndex)
                  }
                  className="text-blue-600"
                />
                <span className="text-gray-900 dark:text-white font-medium">
                  {option}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <React.Fragment>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex flex-col gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${questionIndex}`}
                    checked={question.correctAnswer === optionIndex}
                    onChange={() =>
                      onUpdateQuestion(questionIndex, "correctAnswer", optionIndex)
                    }
                    className="text-blue-600"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) =>
                      onUpdateOption(questionIndex, optionIndex, e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder={t("optionChoice", { number: optionIndex + 1 })}
                  />
                </div>
                {option && (
                  <div className="mr-8 text-sm p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/30 dark:border-blue-800/30">
                    <LatexRenderer text={option} />
                  </div>
                )}
              </div>
            ))}
          </React.Fragment>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("answerExplanation")}
        </label>
        <input
          type="text"
          value={question.explanation}
          onChange={(e) =>
            onUpdateQuestion(questionIndex, "explanation", e.target.value)
          }
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder={t("explanationPlaceholder")}
        />
        {question.explanation && (
          <div className="mt-2 text-sm p-2 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100/30 dark:border-green-800/30">
            <LatexRenderer text={question.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}
