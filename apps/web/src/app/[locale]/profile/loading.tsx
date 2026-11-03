import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /profile (spec 032, SPLIT-2).
 * Avatar + identity block + settings rows; static JSX, RTL-neutral.
 */
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-1/3 rounded-md" />
          <Skeleton className="h-4 w-1/4 rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="h-5 w-1/4 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
