import React from "react";
import { motion } from "framer-motion";
import type { ExamQuestion, SetExamFormData } from "./types";

interface QuestionItemProps {
  question: ExamQuestion;
  idx: number;
  totalQuestions: number;
  setExamFormData: SetExamFormData;
  tSubjectPage: (key: string) => string;
}

export function QuestionItem({
  question,
  idx,
  totalQuestions,
  setExamFormData,
  tSubjectPage,
}: QuestionItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-brand-blue/20 transition-all"
    >
      <div className="flex justify-between mb-4">
        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
          {tSubjectPage("exam.question")} {idx + 1}
        </span>
        {totalQuestions > 1 && (
          <button
            onClick={() =>
              setExamFormData((p) => ({
                ...p,
                questions: p.questions.filter((_, i) => i !== idx),
              }))
            }
            className="text-red-500 font-bold text-xs"
          >
            {tSubjectPage("exam.deleteQuestion")}
          </button>
        )}
      </div>
      <input
        value={question.question}
        onChange={(e) =>
          setExamFormData((p) => ({
            ...p,
            questions: p.questions.map((it, i) =>
              i === idx ? { ...it, question: e.target.value } : it,
            ),
          }))
        }
        placeholder={tSubjectPage("exam.questionPlaceholder")}
        className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold mb-4 text-gray-900 dark:text-white"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {question.options.map((opt, optIdx) => (
          <input
            key={optIdx}
            value={opt}
            onChange={(e) =>
              setExamFormData((p) => ({
                ...p,
                questions: p.questions.map((it, i) =>
                  i === idx
                    ? {
                        ...it,
                        options: it.options.map((o: string, oi: number) =>
                          oi === optIdx ? e.target.value : o,
                        ),
                      }
                    : it,
                ),
              }))
            }
            placeholder={`${tSubjectPage("exam.option")} ${optIdx + 1}`}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold text-gray-900 dark:text-white"
          />
        ))}
      </div>
      <div className="mt-4 flex gap-4">
        <select
          value={question.correctAnswer}
          onChange={(e) =>
            setExamFormData((p) => ({
              ...p,
              questions: p.questions.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      correctAnswer: Number(e.target.value),
                    }
                  : it,
              ),
            }))
          }
          className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 font-bold outline-none text-gray-900 dark:text-white"
        >
          <option value={0}>{tSubjectPage("exam.option1Correct")}</option>
          <option value={1}>{tSubjectPage("exam.option2Correct")}</option>
          <option value={2}>{tSubjectPage("exam.option3Correct")}</option>
          <option value={3}>{tSubjectPage("exam.option4Correct")}</option>
        </select>
      </div>
    </motion.div>
  );
}
