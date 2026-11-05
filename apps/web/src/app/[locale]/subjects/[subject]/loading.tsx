import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /subjects/[subject] (spec 032, SPLIT-2).
 * Header block + lecture-card grid; static JSX, RTL-neutral grid.
 */
export default function SubjectLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3">
        <Skeleton className="h-9 w-1/2 rounded-lg" />
        <Skeleton className="h-5 w-1/3 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="mb-3 h-6 w-2/3 rounded-md" />
            <Skeleton className="mb-2 h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
