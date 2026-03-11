import { Plus } from "lucide-react";

interface AddLectureFormProps {
  newLecture: { title: string; orderIndex: string };
  setNewLecture: (lecture: { title: string; orderIndex: string }) => void;
  onAdd: () => void;
  t: any;
}

export function AddLectureForm({
  newLecture,
  setNewLecture,
  onAdd,
  t,
}: AddLectureFormProps) {
  return (
    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-3">
        {t("addNewLecture")}
      </h3>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder={t("lectureForm.titlePlaceholder")}
          value={newLecture.title}
          onChange={(e) =>
            setNewLecture({ ...newLecture, title: e.target.value })
          }
          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <input
          type="number"
          placeholder={t("lectureForm.orderPlaceholder")}
          value={newLecture.orderIndex}
          onChange={(e) =>
            setNewLecture({ ...newLecture, orderIndex: e.target.value })
          }
          className="w-20 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
