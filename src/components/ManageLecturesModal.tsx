import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  BookOpen,
  Edit as EditIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";

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
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLecture, setNewLecture] = useState({ title: "", orderIndex: "" });

  useEffect(() => {
    if (show && subjectName) {
      fetchLectures();
    }
  }, [show, subjectName]);

  async function fetchLectures() {
    try {
      setLoading(true);

      // Standardize the subject name for matching
      const decodedName = decodeURIComponent(subjectName).trim();
      const normalizedName = decodedName.replace(/\s+/g, " ");

      console.log("Fetching lectures for standardized:", normalizedName);

      // Use ILIKE for case-insensitive and more flexible matching with Arabic characters
      // We use % around the term to ensure we find matches even with slight variations
      const { data, error } = await supabase
        .from("subject_lectures")
        .select("*")
        .or(
          `subject.ilike.%${normalizedName}%,subject.ilike.%${decodedName}%,subject.ilike.%${subjectName}%`,
        )
        .order("order_index", { ascending: true });

      if (error) throw error;

      console.log("Lectures found:", data?.length || 0);
      setLectures(data || []);
    } catch (error) {
      console.error("Error fetching lectures:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddLecture = async () => {
    if (!newLecture.title.trim()) return;
    try {
      const order = newLecture.orderIndex
        ? parseInt(newLecture.orderIndex)
        : 999;

      const standardizedSubject = decodeURIComponent(subjectName)
        .trim()
        .replace(/\s+/g, " ");

      const { error } = await supabase.from("subject_lectures").insert({
        subject: standardizedSubject,
        lecture_label: newLecture.title,
        lecture_key: `lec-${Date.now()}`,
        order_index: order,
      });
      if (error) throw error;
      setNewLecture({ title: "", orderIndex: "" });
      fetchLectures();
    } catch (error) {
      console.error("Error adding lecture:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المحاضرة؟")) return;
    try {
      const { error } = await supabase
        .from("subject_lectures")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchLectures();
    } catch (error) {
      console.error("Error deleting lecture:", error);
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("subject_lectures")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      setEditingId(null);
      fetchLectures();
    } catch (error) {
      console.error("Error updating lecture:", error);
    }
  };

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
                إدارة المحاضرات
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
          {/* Add New Lecture */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-3">
              إضافة محاضرة جديدة
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="عنوان المحاضرة"
                value={newLecture.title}
                onChange={(e) =>
                  setNewLecture({ ...newLecture, title: e.target.value })
                }
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <input
                type="number"
                placeholder="الترتيب"
                value={newLecture.orderIndex}
                onChange={(e) =>
                  setNewLecture({ ...newLecture, orderIndex: e.target.value })
                }
                className="w-20 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <button
                onClick={handleAddLecture}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lectures List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : lectures.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                لا توجد محاضرات مضافة بعد
              </div>
            ) : (
              lectures.map((lec) => (
                <div
                  key={lec.id}
                  className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-blue-500/30 transition-all"
                >
                  {editingId === lec.id ? (
                    <div className="flex-1 flex gap-3">
                      <input
                        type="text"
                        defaultValue={lec.lecture_label}
                        id={`edit-label-${lec.id}`}
                        className="flex-1 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <input
                        type="number"
                        defaultValue={lec.order_index}
                        id={`edit-order-${lec.id}`}
                        className="w-16 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                      <button
                        onClick={() => {
                          const label = (
                            document.getElementById(
                              `edit-label-${lec.id}`,
                            ) as HTMLInputElement
                          ).value;
                          const order = parseInt(
                            (
                              document.getElementById(
                                `edit-order-${lec.id}`,
                              ) as HTMLInputElement
                            ).value,
                          );
                          handleUpdate(lec.id, {
                            lecture_label: label,
                            order_index: order,
                          });
                        }}
                        className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all"
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
                  ) : (
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
                          onClick={() => setEditingId(lec.id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lec.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
