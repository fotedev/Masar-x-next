import React from "react";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

export function SemesterSwitcher() {
  const { loading, activeSemester, setActiveSemester } = usePlatformSettings();

  const setSemester = async (s: number) => {
    if (s === activeSemester) return;
    await setActiveSemester(s);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        الترم النشط:
      </span>
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setSemester(1)}
          disabled={loading}
          className={`px-3 py-1 rounded-md text-sm font-semibold transition ${
            activeSemester === 1
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          ترم 1
        </button>
        <button
          onClick={() => setSemester(2)}
          disabled={loading}
          className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold transition ${
            activeSemester === 2
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          ترم 2
        </button>
      </div>
    </div>
  );
}
