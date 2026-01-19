'use client';

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QuizPlayer } from "../../components/QuizPlayer";

function QuizPlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams?.get("quizId");

  if (!quizId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <p className="text-red-500 font-medium">لم يتم العثور على معرف الاختبار.</p>
        <button 
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return <QuizPlayer quizId={quizId} onClose={() => router.push('/')} />;
}

export default function QuizPlay() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <QuizPlayContent />
    </Suspense>
  );
}
