import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { BasicExamInfo } from "./add-exam/BasicExamInfo";
import { QuestionList } from "./add-exam/QuestionList";

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
              <BasicExamInfo
                examFormData={examFormData}
                setExamFormData={setExamFormData as any}
                levels={levels}
                availableExamDepartments={availableExamDepartments}
                academicOptionsLoading={academicOptionsLoading}
                tSubjectPage={tSubjectPage}
              />

              <QuestionList
                questions={examFormData.questions}
                setExamFormData={setExamFormData as any}
                tSubjectPage={tSubjectPage}
              />

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
