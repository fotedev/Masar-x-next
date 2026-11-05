import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /news (spec 032, SPLIT-2).
 * News-card grid with image placeholder; static JSX, RTL-neutral.
 */
export default function NewsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <Skeleton className="mb-6 h-9 w-1/3 rounded-lg" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-5">
              <Skeleton className="mb-3 h-6 w-3/4 rounded-md" />
              <Skeleton className="mb-2 h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
