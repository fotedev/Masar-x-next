/**
 * Quiz attempt row types for mobile.
 *
 * The shared Database type (masarx-shared/types) covers `quizzes` and
 * the `quizzes_with_ratings` view, but not the attempt tables. These
 * shapes mirror exactly what the web app reads/writes
 * (apps/web/src/lib/quiz.ts + useQuizAttempt.ts) so the mobile player
 * consumes the same tables with the same columns.
 */
export interface QuizAttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  started_at: string;
  finished_at: string | null;
  time_taken_seconds: number | null;
  status: string | null;
}

export interface QuizAnswerRow {
  id?: string;
  attempt_id: string;
  question_id: string;
  selected_option: number;
  is_correct: boolean;
  created_at: string;
}

export interface PlayerQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string | null;
}