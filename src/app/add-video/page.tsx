import { Suspense } from "react";
import { AddVideoForm } from "./AddVideoForm";

export const dynamic = "force-dynamic";

export default function AddVideoPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              جاري التحميل...
            </p>
          </div>
        </div>
      }
    >
      <AddVideoForm />
    </Suspense>
  );
}
