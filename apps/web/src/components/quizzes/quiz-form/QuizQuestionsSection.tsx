
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { QuizQuestionEditor } from "./QuizQuestionEditor";
import type { QuizQuestion } from "./types";

export function QuizQuestionsSection(props: {
  questions: QuizQuestion[];
  onAddQuestion: () => void;
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
    questions,
    onAddQuestion,
    onDeleteQuestion,
    onUpdateQuestion,
    onUpdateOption,
    onImageUpload,
  } = props;

  const t = useTranslations("quizzes");

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("questions")}
        </h3>
        <button
          onClick={onAddQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("addQuestion")}
        </button>
      </div>

      {questions.map((question, questionIndex) => (
        <QuizQuestionEditor
          key={questionIndex}
          question={question}
          questionIndex={questionIndex}
          onDeleteQuestion={onDeleteQuestion}
          onUpdateQuestion={onUpdateQuestion}
          onUpdateOption={onUpdateOption}
          onImageUpload={onImageUpload}
        />
      ))}
    </div>
  );
}
