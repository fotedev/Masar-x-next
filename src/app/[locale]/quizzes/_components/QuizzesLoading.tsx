

import { Skeleton } from "@/components/ui/Skeleton";

export function QuizzesLoading() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <Skeleton className="h-7 w-3/4 rounded-lg mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            </div>
          </div>

          <Skeleton className="h-4 w-full rounded-md mb-2" />
          <Skeleton className="h-4 w-2/3 rounded-md mb-6" />

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-50 dark:border-gray-700">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
