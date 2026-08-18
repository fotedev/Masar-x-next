import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertCircle } from "lucide-react";
import { Database } from "../types/database";
import { useAcademicOptions } from "../hooks/useAcademicOptions";
import { useTranslations } from "next-intl";
import { useAddSubjectForm } from "@/hooks/useAddSubjectForm";
import { BasicInfoFields } from "./subject-form/BasicInfoFields";
import { ScheduleFields } from "./subject-form/ScheduleFields";
import { AcademicOptionsFields } from "./subject-form/AcademicOptionsFields";

type SubjectInsert = Database["public"]["Tables"]["subjects"]["Insert"];

interface AddSubjectModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (subject: SubjectInsert) => Promise<void>;
  editingSubject?: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

export function AddSubjectModal({
  show,
  onClose,
  onSave,
  editingSubject,
}: AddSubjectModalProps) {
  const tAddSubjectModal = useTranslations("addSubjectModal");
  const { levels, optionsLoading } = useAcademicOptions({
    includeInactive: true,
  });

  const { formData, setFormData, loading, error, handleSubmit } =
    useAddSubjectForm({ editingSubject, show, onSave, onClose });

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] relative z-10"
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSubject ? tAddSubjectModal("editSubject") : tAddSubjectModal("addSubject")}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <BasicInfoFields
                formData={formData}
                setFormData={setFormData}
                t={tAddSubjectModal}
              />

              <ScheduleFields formData={formData} setFormData={setFormData} />

              <AcademicOptionsFields
                formData={formData}
                setFormData={setFormData}
                levels={levels}
                optionsLoading={optionsLoading}
                t={tAddSubjectModal}
              />

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {loading ? tAddSubjectModal("saving") : tAddSubjectModal("saveSubject")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  {tAddSubjectModal("cancel")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
