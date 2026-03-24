import { useMemo, useState } from "react";
import { Brain, X } from "lucide-react";
import { aiAssistant } from "@/lib/ai-assistant";

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

export function QuickQuizFromTextModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (quizData: LocalQuizData, sourceText: string) => void;
}) {
  const { isOpen, onClose, onGenerated } = props;

  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const canGenerate = useMemo(() => text.trim().length > 20 && !isGenerating, [text, isGenerating]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      setIsGenerating(true);
      const result = await aiAssistant.generateQuiz(text);

      const normalized: LocalQuizData = {
        title: result.title || "اختبار سريع",
        description: undefined,
        questions: (result.questions || []).map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
      };

      onGenerated(normalized, text);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Brain className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="font-black text-slate-900 dark:text-white">اختبار سريع من نص</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            aria-label="إغلاق"
            type="button"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300" dir="auto">
            الصق نص المحاضرة/الملخص هنا، وسأحوّله لاختبار تفاعلي.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="الصق النص هنا..."
            className="w-full h-56 sm:h-64 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 font-medium leading-relaxed"
            dir="auto"
          />

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              type="button"
            >
              إلغاء
            </button>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`px-6 py-2.5 rounded-2xl font-black transition-all active:scale-95 shadow-lg ${
                canGenerate
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              }`}
              type="button"
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  جاري التوليد
                </span>
              ) : (
                "توليد الاختبار"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
