"use client";

import { useRouter } from "@/i18n/routing";
import { QuizPlayer } from "@/components/QuizPlayer";
import { PreloadKatex } from "@/components/quiz/PreloadKatex";
import { use } from "react";

export default function QuizPlayPage({
  params,
}: {
  params: Promise<{ locale: string; quizId: string }>;
}) {
  const router = useRouter();
  const { quizId } = use(params);

  return (
    <>
      <PreloadKatex />
      <QuizPlayer quizId={quizId} onClose={() => router.push("/quizzes")} />
    </>
  );
}
