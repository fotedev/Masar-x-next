import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /quizzes (spec 032, SPLIT-2).
 * Same card-grid shape as _components/QuizzesLoading, as a
 * default-export server component for the route segment.
 */
export default function QuizzesRouteLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <Skeleton className="mb-6 h-9 w-1/3 rounded-lg" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="mb-2 h-7 w-3/4 rounded-lg" />
            <div className="mb-4 flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
            <Skeleton className="mb-2 h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
