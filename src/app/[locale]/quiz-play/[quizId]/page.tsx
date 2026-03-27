"use client";

import { useRouter } from "@/i18n/routing";
import { QuizPlayer } from "@/components/QuizPlayer";
import { PreloadKatex } from "@/components/quiz/PreloadKatex";

export default function QuizPlayPage({
  params,
}: {
  params: { locale: string; quizId: string };
}) {
  const router = useRouter();
  const { quizId } = params;

  return (
    <>
      <PreloadKatex />
      <QuizPlayer quizId={quizId} onClose={() => router.push("/quizzes")} />
    </>
  );
}
