import { X, Save, BookOpen, Edit as EditIcon, Trash2 } from "lucide-react";

type Lecture = {
  id: string;
  subject: string;
  lecture_label: string;
  lecture_key: string;
  order_index: number;
  created_at: string;
};

type LectureUpdates = Partial<{
  lecture_label: string;
  order_index: number;
  updated_at: string;
}>;

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface LectureItemProps {
  lec: Lecture;
  editingId: string | null;
  editLecture: { id: string; label: string; orderIndex: string };
  setEditingId: (id: string | null) => void;
  setEditLecture: (edit: {
    id: string;
    label: string;
    orderIndex: string;
  }) => void;
  onUpdate: (id: string, updates: LectureUpdates) => void;
  onDelete: (id: string) => void;
  onShowContent: (lec: Lecture) => void;
  t: TranslationFn;
}

export function LectureItem({
  lec,
  editingId,
  editLecture,
  setEditingId,
  setEditLecture,
  onUpdate,
  onDelete,
  onShowContent,
  t,
}: LectureItemProps) {
  if (editingId === lec.id) {
    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={editLecture.label}
            onChange={(e) =>
              setEditLecture({ ...editLecture, label: e.target.value })
            }
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
          <input
            type="number"
            value={editLecture.orderIndex}
            onChange={(e) =>
              setEditLecture({ ...editLecture, orderIndex: e.target.value })
            }
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              const label = (editLecture.label || "").trim();
              const orderNum = Number(editLecture.orderIndex);
              if (!label) return;
              onUpdate(lec.id, {
                lecture_label: label,
                order_index: Number.isFinite(orderNum)
                  ? Math.floor(orderNum)
                  : 999999,
                updated_at: new Date().toISOString(),
              });
            }}
            className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all"
            title={t("lectureForm.save")}
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400">
          {lec.order_index}
        </span>
        <span className="font-bold text-gray-700 dark:text-gray-200">
          {lec.lecture_label}
        </span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onShowContent(lec)}
          className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
          title={t("lectureForm.manageContent")}
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditingId(lec.id);
            setEditLecture({
              id: lec.id,
              label: lec.lecture_label || "",
              orderIndex:
                lec.order_index === null || lec.order_index === undefined
                  ? ""
                  : String(lec.order_index),
            });
          }}
          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
          title={t("lectureForm.edit")}
        >
          <EditIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(lec.id)}
          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
          title={t("lectureForm.delete")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
