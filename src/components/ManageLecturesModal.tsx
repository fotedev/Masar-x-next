import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, BookOpen } from "lucide-react";
import { LectureContentModal } from "./subject/LectureContentModal";
import { useManageLectures } from "@/hooks/useManageLectures";
import { AddLectureForm } from "./lectures/AddLectureForm";
import { LectureItem } from "./lectures/LectureItem";

type SubjectLecture = {
  id: string;
  subject: string;
  lecture_label: string;
  lecture_key: string;
  order_index: number;
  created_at: string;
};

interface ManageLecturesModalProps {
  show: boolean;
  onClose: () => void;
  subjectName: string;
}

export function ManageLecturesModal({
  show,
  onClose,
  subjectName,
}: ManageLecturesModalProps) {
  const t = useTranslations("subjectPage");
  const [showLectureContent, setShowLectureContent] = useState(false);
  const [selectedLectureForContent, setSelectedLectureForContent] =
    useState<SubjectLecture | null>(null);

  const standardizedSubject = decodeURIComponent(subjectName)
    .trim()
    .replace(/\s+/g, " ");

  const {
    lectures,
    loading,
    editingId,
    setEditingId,
    newLecture,
    setNewLecture,
    editLecture,
    setEditLecture,
    handleAddLecture,
    handleDelete,
    handleUpdate,
  } = useManageLectures({ show, subjectName, standardizedSubject });

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("lecturesList")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subjectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AddLectureForm
            newLecture={newLecture}
            setNewLecture={setNewLecture}
            onAdd={handleAddLecture}
            t={t}
          />

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : lectures.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                {t("noLecturesYet")}
              </div>
            ) : (
              lectures.map((lec) => (
                <div
                  key={lec.id}
                  className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-blue-500/30 transition-all"
                >
                  <LectureItem
                    lec={lec}
                    editingId={editingId}
                    editLecture={editLecture}
                    setEditingId={setEditingId}
                    setEditLecture={setEditLecture}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onShowContent={(l) => {
                      setSelectedLectureForContent(l);
                      setShowLectureContent(true);
                    }}
                    t={t}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <LectureContentModal
        show={showLectureContent}
        onClose={() => {
          setShowLectureContent(false);
          setSelectedLectureForContent(null);
        }}
        subject={standardizedSubject}
        lecture={selectedLectureForContent}
        lecturesIndex={lectures.map((l) => ({
          id: l.id,
          title: l.lecture_label,
          lecture_key: l.lecture_key,
        }))}
      />
    </div>
  );
}
