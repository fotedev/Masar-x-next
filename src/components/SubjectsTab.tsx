import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  GraduationCap,
  BookOpen as BookOpenIcon,
} from "lucide-react";
import { Subject } from "../types/database";
import { supabase } from "../lib/supabase";
import { SUBJECT_ICONS } from "../constants/subjects";
import { toast } from "sonner";
import { confirmToast } from "../lib/confirmToast";

interface SubjectsTabProps {
  subjects: Subject[];
  onRefresh: () => void;
  onEdit: (subject: Subject) => void;
  onAdd: () => void;
  onManageLectures: (subject: Subject) => void;
}

export function SubjectsTab({
  subjects,
  onRefresh,
  onEdit,
  onAdd,
  onManageLectures,
}: SubjectsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.professor || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subjects, searchTerm, statusFilter]);

  const handleUpdateStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    try {
      const { error } = await supabase
        .from("subjects")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error("Error updating subject status:", error);
      toast.error("حدث خطأ أثناء تحديث حالة المادة");
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذه المادة؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast.error("حدث خطأ أثناء حذف المادة");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full md:max-w-md relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث عن مادة أو دكتور..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
          </select>

          <button
            onClick={onAdd}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            إضافة مادة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => {
          const IconComponent = SUBJECT_ICONS[subject.name] || BookOpenIcon;

          return (
            <div
              key={subject.id}
              className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`p-3 rounded-2xl ${
                    subject.status === "approved"
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                      : subject.status === "rejected"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                        : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                  }`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(subject)}
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {subject.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <GraduationCap className="w-4 h-4" />
                {subject.professor || "لم يتم تحديد دكتور"}
              </div>

              <button
                onClick={() => onManageLectures(subject)}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all text-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
              >
                <BookOpenIcon className="w-4 h-4" />
                عرض وإدارة المحاضرات
              </button>

              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                {subject.description || "لا يوجد وصف لهذه المادة"}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                <div className="flex gap-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    المستوى {subject.level}
                  </span>
                  <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    الترم {subject.semester}
                  </span>
                </div>

                {subject.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus(subject.id, "approved")}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-all"
                      title="اعتماد"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(subject.id, "rejected")}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all"
                      title="رفض"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            لا توجد مواد تطابق بحثك
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            ابدأ بإضافة أول مادة دراسية الآن
          </p>
        </div>
      )}
    </div>
  );
}
