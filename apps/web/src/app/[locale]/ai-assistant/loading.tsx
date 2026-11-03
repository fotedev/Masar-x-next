import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /ai-assistant (spec 032, SPLIT-2).
 * Static JSX only — rendered while the page segment resolves; no data,
 * no hooks, RTL-neutral (centered, relative widths).
 */
export default function AiAssistantLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="flex w-full max-w-2xl flex-col items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-7 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <Skeleton className="h-16 w-4/5 rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-3/5 rounded-2xl" />
        <Skeleton className="h-20 w-11/12 rounded-2xl" />
      </div>
      <Skeleton className="h-12 w-full max-w-2xl rounded-full" />
    </div>
  );
}
