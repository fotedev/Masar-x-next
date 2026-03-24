"use client";

import { useRouter } from "@/i18n/routing";
import { QuizPlayer } from "@/components/QuizPlayer";

export default function QuizPlayPage({
  params,
}: {
  params: { locale: string; quizId: string };
}) {
  const router = useRouter();
  const { quizId } = params;

  return (
    <QuizPlayer 
      quizId={quizId} 
      onClose={() => router.push("/quizzes")} 
    />
  );
}
