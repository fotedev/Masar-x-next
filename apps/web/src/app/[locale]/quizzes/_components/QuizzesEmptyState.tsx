import { BookOpen } from "lucide-react";

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export function QuizzesEmptyState(props: { t: Translator }) {
  const { t } = props;

  return (
    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
      <div className="bg-blue-50 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {t("noExamsFound")}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {t("tryAdjustingFilters")}
      </p>
    </div>
  );
}
