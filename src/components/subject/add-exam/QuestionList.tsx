import React from "react";
import { Plus } from "lucide-react";
import { QuestionItem } from "./QuestionItem";
import type { ExamQuestion, SetExamFormData } from "./types";

interface QuestionListProps {
  questions: ExamQuestion[];
  setExamFormData: SetExamFormData;
  tSubjectPage: (key: string) => string;
}

export function QuestionList({
  questions,
  setExamFormData,
  tSubjectPage,
}: QuestionListProps) {
  const addQuestion = () => {
    setExamFormData((p) => ({
      ...p,
      questions: [
        ...p.questions,
        {
          question: "",
          options: ["", "", "", ""],
          correctAnswer: 0,
          explanation: "",
        },
      ],
    }));
  };

  return (
    <div className="pt-6 border-t-2 border-slate-50 dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-xl font-black text-slate-900 dark:text-white">
          {tSubjectPage("exam.questions")}
        </h4>
        <button
          onClick={addQuestion}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold hover:bg-brand-blue hover:text-white transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {tSubjectPage("exam.addQuestion")}
        </button>
      </div>

      <div className="space-y-8">
        {questions.map((q, idx) => (
          <QuestionItem
            key={idx}
            question={q}
            idx={idx}
            totalQuestions={questions.length}
            setExamFormData={setExamFormData}
            tSubjectPage={tSubjectPage}
          />
        ))}
      </div>
    </div>
  );
}
