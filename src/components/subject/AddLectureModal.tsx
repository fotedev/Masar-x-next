import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type LectureFormData = {
  title: string;
  label: string;
  key: string;
  orderIndex: string;
};

type LectureInfo = {
  key: string;
  label: string;
};

export function AddLectureModal(props: {
  isOpen: boolean;
  onClose: () => void;
  tSubjectPage: (key: string) => string;
  tCommon: (key: string) => string;
  lectureFormData: LectureFormData;
  setLectureFormData: (
    updater: (prev: LectureFormData) => LectureFormData,
  ) => void;
  getLectureInfoFromTitle: (title: string) => LectureInfo;
  isSavingLecture: boolean;
  onSaveLecture: () => void;
}) {
  const {
    isOpen,
    onClose,
    tSubjectPage,
    tCommon,
    lectureFormData,
    setLectureFormData,
    getLectureInfoFromTitle,
    isSavingLecture,
    onSaveLecture,
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
            className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative"
          >
            <button
              onClick={onClose}
              className="absolute top-6 left-6 text-slate-400 hover:text-brand-blue transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
              {tSubjectPage("addNewLecture")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  {tSubjectPage("lectureForm.titleLabel")}
                </label>
                <input
                  type="text"
                  value={lectureFormData.title}
                  onChange={(e) =>
                    setLectureFormData((p) => ({
                      ...p,
                      title: e.target.value,
                      ...(p.key.trim()
                        ? {}
                        : { key: getLectureInfoFromTitle(e.target.value).key }),
                    }))
                  }
                  placeholder={tSubjectPage("lectureForm.titlePlaceholder")}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  {tSubjectPage("lectureForm.labelLabel")}
                </label>
                <input
                  type="text"
                  value={lectureFormData.label}
                  onChange={(e) =>
                    setLectureFormData((p) => ({ ...p, label: e.target.value }))
                  }
                  placeholder={
                    getLectureInfoFromTitle(lectureFormData.title).label
                  }
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  {tSubjectPage("orderOptional")}
                </label>
                <input
                  type="number"
                  value={lectureFormData.orderIndex}
                  onChange={(e) =>
                    setLectureFormData((p) => ({
                      ...p,
                      orderIndex: e.target.value,
                    }))
                  }
                  placeholder={tSubjectPage("lectureForm.orderPlaceholder")}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>

              <button
                onClick={onSaveLecture}
                disabled={isSavingLecture || !lectureFormData.title.trim()}
                className="w-full py-4 rounded-2xl bg-brand-blue text-white font-black text-lg hover:shadow-xl hover:shadow-brand-blue/30 disabled:opacity-50 transition-all mt-4"
              >
                {isSavingLecture
                  ? tCommon("loading")
                  : tSubjectPage("lectureForm.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
