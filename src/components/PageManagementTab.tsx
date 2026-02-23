import { Layout, Eye, EyeOff, Search } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSubjects } from "../hooks/useSubjects";
import { SemesterSwitcher } from "./SemesterSwitcher";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

export function PageManagementTab() {
  const { activeSemester, loading: settingsLoading } = usePlatformSettings();
  const {
    subjects,
    loading: subjectsLoading,
    updateSubjectVisibility,
  } = useSubjects();
  const [searchTerm, setSearchTerm] = useState("");

  const isLoading = subjectsLoading || settingsLoading;

  // Re-calculate filtered subjects whenever activeSemester or subjects change
  const filteredSubjects = useMemo(() => {
    if (!subjects || subjects.length === 0) return [];

    // 1. Filter by active semester
    const semesterFiltered = subjects.filter((s) => {
      const subjectSem = s.semester ? Number(s.semester) : null;
      if (subjectSem === null) return true;
      return subjectSem === activeSemester;
    });

    // 2. Filter by search term
    if (!searchTerm) return semesterFiltered;
    return semesterFiltered.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [subjects, searchTerm, activeSemester]);

  // Effect to handle manual refresh if needed, though useSubjects should handle it
  useEffect(() => {
    // This effect ensures that when activeSemester changes,
    // we are at least aware of it in this component
    console.log("Active semester changed to:", activeSemester);
  }, [activeSemester]);

  if (isLoading && subjects.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-blue-500" />
            إدارة محتوى الصفحة الرئيسية
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تحكم في المواد التي تظهر للطلاب في الصفحة الرئيسية
          </p>
        </div>
        <div className="mt-3 sm:mt-0">
          <SemesterSwitcher />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="البحث عن مادة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => (
          <div
            key={subject.id}
            className={`p-5 rounded-xl border transition-all duration-300 ${
              subject.show_on_home
                ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-75"
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <h3
                className={`font-bold text-base ${
                  subject.show_on_home
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {subject.name}
              </h3>
              <div
                className={`p-2 rounded-lg ${
                  subject.show_on_home
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                }`}
              >
                {subject.show_on_home ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {subject.show_on_home ? "ظاهرة للطلاب" : "مخفية"}
              </span>
              <button
                onClick={() =>
                  updateSubjectVisibility(subject.id, !subject.show_on_home)
                }
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  subject.show_on_home
                    ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                }`}
              >
                {subject.show_on_home ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <Layout className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            لا توجد مواد تطابق بحثك
          </p>
        </div>
      )}
    </div>
  );
}
