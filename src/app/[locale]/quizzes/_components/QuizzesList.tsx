import { useMemo } from "react";
import type { Quiz } from "@/types/database";
import { QuizGridItem } from "@/components/quizzes/QuizGridItem";

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

type QuizMeta = {
  subject: string;
  department: string;
  year: string;
  semester: string;
  descriptionText: string;
};

type QuizWithMeta = {
  quiz: Quiz;
  meta: QuizMeta;
};

export function QuizzesList(props: {
  quizzes: Quiz[];
  quizzesWithMeta: QuizWithMeta[];
  isAdmin: boolean;
  t: Translator;
  onPlay: (quiz: Quiz) => void;
  onEdit: (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
  onViewSummary: (summaryId: string) => void;
}) {
  const {
    quizzes,
    quizzesWithMeta,
    isAdmin,
    t,
    onPlay,
    onEdit,
    onDelete,
    onViewSummary,
  } = props;

  const metaById = useMemo(() => {
    const map = new Map<string, QuizMeta>();
    quizzesWithMeta.forEach(({ quiz, meta }) => {
      map.set(quiz.id, meta);
    });
    return map;
  }, [quizzesWithMeta]);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((quiz) => {
        const meta = metaById.get(quiz.id) || {
          subject: "",
          department: "",
          year: "",
          semester: "",
          descriptionText: "",
        };

        return (
          <QuizGridItem
            key={quiz.id}
            quiz={quiz}
            meta={meta}
            isAdmin={isAdmin}
            t={t}
            onPlay={onPlay}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewSummary={onViewSummary}
          />
        );
      })}
    </div>
  );
}
