import { useEffect, useState } from "react";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

export function SemesterSwitcher() {
  const { loading, activeSemester, setActiveSemester } = usePlatformSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setSemester = async (s: number) => {
    if (s === activeSemester) return;
    await setActiveSemester(s);
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-3 opacity-0">
        <span className="text-sm font-medium">الترم النشط:</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 animate-in fade-in duration-300">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        الترم النشط:
      </span>
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-inner">
        <button
          onClick={() => setSemester(1)}
          disabled={loading}
          className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors transition-transform duration-200 ${
            activeSemester === 1
              ? "bg-blue-600 text-white shadow-sm scale-105"
              : "text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          type="button"
        >
          ترم 1
        </button>
        <button
          onClick={() => setSemester(2)}
          disabled={loading}
          className={`ml-1 px-4 py-1.5 rounded-md text-sm font-bold transition-colors transition-transform duration-200 ${
            activeSemester === 2
              ? "bg-blue-600 text-white shadow-sm scale-105"
              : "text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          type="button"
        >
          ترم 2
        </button>
      </div>
      {loading && (
        <div aria-live="polite" className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  );
}
