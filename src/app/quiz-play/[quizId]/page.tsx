'use client';

import { useRouter } from "next/navigation";
import { QuizPlayer } from "../../../components/QuizPlayer";

export default function QuizPlayPage({ params }: { params: { quizId: string } }) {
  const router = useRouter();
  const { quizId } = params;

  return <QuizPlayer quizId={quizId} onClose={() => router.push('/')} />;
}
