import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";

type LevelOption = {
  id: string;
  name: string;
  is_active?: boolean;
};

type DepartmentOption = {
  id: string;
  name: string;
  is_active?: boolean;
};

type ExamQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

type ExamFormData = {
  title: string;
  description: string;
  durationMinutes: string;
  department: string;
  year: string;
  questions: ExamQuestion[];
};

export function AddExamModal(props: {
  isOpen: boolean;
  onClose: () => void;
  tSubjectPage: (key: string) => string;
  tCommon: (key: string) => string;
  levels: LevelOption[];
  academicOptionsLoading: boolean;
  availableExamDepartments: DepartmentOption[];
  examFormData: ExamFormData;
  setExamFormData: (updater: (prev: ExamFormData) => ExamFormData) => void;
  isSavingExam: boolean;
  onSaveExam: () => void;
}) {
  const {
    isOpen,
    onClose,
    tSubjectPage,
    tCommon,
    levels,
    academicOptionsLoading,
    availableExamDepartments,
    examFormData,
    setExamFormData,
    isSavingExam,
    onSaveExam,
  } = props;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {tSubjectPage("exam.addNew")}
              </h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-brand-blue transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    {tSubjectPage("exam.titleLabel")}
                  </label>
                  <input
                    value={examFormData.title}
                    onChange={(e) =>
                      setExamFormData((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    {tSubjectPage("exam.durationMinutesLabel")}
                  </label>
                  <input
                    type="number"
                    value={examFormData.durationMinutes}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        durationMinutes: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    {tSubjectPage("exam.departmentLabel")}
                  </label>
                  <select
                    value={examFormData.department}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        department: e.target.value,
                      }))
                    }
                    disabled={
                      academicOptionsLoading ||
                      !examFormData.year ||
                      availableExamDepartments.length === 0
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  >
                    <option value="" disabled>
                      {tSubjectPage("exam.departmentPlaceholder")}
                    </option>
                    {availableExamDepartments.map((dep) => (
                      <option key={dep.id} value={dep.name}>
                        {dep.name} {!dep.is_active && tSubjectPage("inactive")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    {tSubjectPage("year")}
                  </label>
                  <select
                    value={examFormData.year}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        year: e.target.value,
                        department: "",
                      }))
                    }
                    disabled={academicOptionsLoading || levels.length === 0}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  >
                    <option value="" disabled>
                      {tSubjectPage("exam.yearPlaceholder")}
                    </option>
                    {levels.map((lvl) => (
                      <option key={lvl.id} value={lvl.name}>
                        {lvl.name} {!lvl.is_active && tSubjectPage("inactive")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t-2 border-slate-50 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">
                    {tSubjectPage("exam.questions")}
                  </h4>
                  <button
                    onClick={() =>
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
                      }))
                    }
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold hover:bg-brand-blue hover:text-white transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />{" "}
                    {tSubjectPage("exam.addQuestion")}
                  </button>
                </div>

                <div className="space-y-8">
                  {examFormData.questions.map((q, idx) => (
                    <motion.div
                      layout
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-brand-blue/20 transition-all"
                    >
                      <div className="flex justify-between mb-4">
                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          {tSubjectPage("exam.question")} {idx + 1}
                        </span>
                        {examFormData.questions.length > 1 && (
                          <button
                            onClick={() =>
                              setExamFormData((p) => ({
                                ...p,
                                questions: p.questions.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="text-red-500 font-bold text-xs"
                          >
                            {tSubjectPage("exam.deleteQuestion")}
                          </button>
                        )}
                      </div>
                      <input
                        value={q.question}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            questions: p.questions.map((it, i) =>
                              i === idx
                                ? { ...it, question: e.target.value }
                                : it,
                            ),
                          }))
                        }
                        placeholder={tSubjectPage("exam.questionPlaceholder")}
                        className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold mb-4"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {q.options.map((opt, optIdx) => (
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
                                        options: it.options.map((o, oi) =>
                                          oi === optIdx ? e.target.value : o,
                                        ),
                                      }
                                    : it,
                                ),
                              }))
                            }
                            placeholder={`${tSubjectPage("exam.option")} ${
                              optIdx + 1
                            }`}
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                          />
                        ))}
                      </div>
                      <div className="mt-4 flex gap-4">
                        <select
                          value={q.correctAnswer}
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
                          className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 font-bold outline-none"
                        >
                          <option value={0}>
                            {tSubjectPage("exam.option1Correct")}
                          </option>
                          <option value={1}>
                            {tSubjectPage("exam.option2Correct")}
                          </option>
                          <option value={2}>
                            {tSubjectPage("exam.option3Correct")}
                          </option>
                          <option value={3}>
                            {tSubjectPage("exam.option4Correct")}
                          </option>
                        </select>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                onClick={onSaveExam}
                disabled={
                  isSavingExam ||
                  !examFormData.title.trim() ||
                  !examFormData.year
                }
                className="w-full py-5 rounded-3xl bg-brand-blue text-white font-black text-xl hover:shadow-2xl hover:shadow-brand-blue/40 disabled:opacity-50 transition-all"
              >
                {isSavingExam
                  ? tCommon("loading")
                  : tSubjectPage("exam.saveButton")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
