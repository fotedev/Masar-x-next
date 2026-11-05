import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level skeleton for /quiz-play/[quizId] (spec 032, SPLIT-2).
 * Mirrors the quiz start-card shape; static JSX, RTL-neutral.
 */
export default function QuizPlayLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-10">
      <Skeleton className="h-8 w-3/4 rounded-lg" />
      <div className="w-full rounded-xl border border-gray-100 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800">
        <Skeleton className="mb-3 h-6 w-2/3 rounded-md" />
        <Skeleton className="mb-2 h-4 w-full rounded-md" />
        <Skeleton className="mb-6 h-4 w-3/5 rounded-md" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}
