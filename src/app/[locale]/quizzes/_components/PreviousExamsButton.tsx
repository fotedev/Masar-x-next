import React from "react";
import { useRouter } from "@/navigation";

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface PreviousExamsButtonProps {
  t: Translator;
}

export function PreviousExamsButton({ t }: PreviousExamsButtonProps) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8">
      <button
        onClick={() => router.push("/quiz-attempts")}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors disabled:opacity-60"
      >
        <div className="font-bold text-gray-900 dark:text-white">
          {t("myPreviousExams")}
        </div>
        <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
          {t("viewDetails")}
        </div>
      </button>
    </div>
  );
}
