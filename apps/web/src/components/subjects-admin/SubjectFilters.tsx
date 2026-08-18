
import { Search, Plus } from "lucide-react";

interface SubjectFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: "all" | "pending" | "approved" | "rejected";
  setStatusFilter: (value: "all" | "pending" | "approved" | "rejected") => void;
  onAdd: () => void;
}

export function SubjectFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  onAdd,
}: SubjectFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex-1 w-full md:max-w-md relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <label htmlFor="subjects-admin-search" className="sr-only">
          بحث
        </label>
        <input
          id="subjects-admin-search"
          name="subjectsAdminSearch"
          type="text"
          placeholder="بحث عن مادة أو دكتور…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-colors"
        />
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <label htmlFor="subjects-admin-status" className="sr-only">
          الحالة
        </label>
        <select
          id="subjects-admin-status"
          name="subjectsAdminStatus"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "pending" | "approved" | "rejected",
            )
          }
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-colors text-sm"
        >
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">معتمدة</option>
          <option value="rejected">مرفوضة</option>
        </select>

        <button
          onClick={onAdd}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/25"
          type="button"
        >
          <Plus className="w-5 h-5" />
          إضافة مادة
        </button>
      </div>
    </div>
  );
}
