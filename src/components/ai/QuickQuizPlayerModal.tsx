import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { QuizPlayer } from "@/components/QuizPlayer";
import { quizService } from "@/lib/quiz";

type LocalQuizData = {
  title: string;
  description?: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
};

export function QuickQuizPlayerModal(props: {
  isOpen: boolean;
  quizData: LocalQuizData | null;
  sourceText: string;
  user: { id: string } | null;
  onClose: () => void;
}) {
  const { isOpen, quizData, sourceText, user, onClose } = props;
  const tAi = useTranslations("aiAssistant");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => Boolean(user?.id) && Boolean(quizData) && !isSubmitting, [user?.id, quizData, isSubmitting]);

  if (!isOpen || !quizData) return null;

  const handleSubmitForReview = async () => {
    if (!canSubmit || !user?.id) {
      toast.error(tAi("signInToSubmit"));
      return;
    }

    try {
      setIsSubmitting(true);
      await quizService.submitQuickQuizForReview(user.id, {
        title: quizData.title,
        description: sourceText,
        questions: quizData.questions,
      });
      toast.success(tAi("quizSubmittedForReview"));
    } catch {
      toast.error(tAi("submitForReviewError"), { description: tAi("submitForReviewErrorDesc") });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="font-black text-slate-900 dark:text-white" dir="auto">
            {quizData.title}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            aria-label={tAi("close")}
            type="button"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <QuizPlayer
            quizData={quizData}
            onClose={onClose}
            forceLocalAttempt
            showSubmitForReview={Boolean(user?.id)}
            onSubmitForReview={user?.id ? handleSubmitForReview : undefined}
            isSubmittingForReview={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
