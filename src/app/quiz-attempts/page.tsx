'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { quizService } from "../../lib/quiz";

export default function QuizAttemptsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        setLoading(true);
        const data = await quizService.getUserAttempts(user.id);
        setAttempts(data || []);
      } catch (error) {
        console.error("Error loading quiz attempts:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const attemptsWithDerived = useMemo(() => {
    return attempts.map((a) => {
      const startedAt = a.started_at ? new Date(a.started_at) : null;
      const finishedAt = a.finished_at ? new Date(a.finished_at) : null;
      return {
        ...a,
        _startedAt: startedAt,
        _finishedAt: finishedAt,
      };
    });
  }, [attempts]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            نتائج الامتحانات السابقة
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            يمكنك مشاهدة محاولاتك السابقة بالتفصيل
          </p>
        </div>

        <button
          onClick={() => router.push("/quizzes")}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          العودة
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : attemptsWithDerived.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="text-gray-700 dark:text-gray-300">
            لا توجد محاولات سابقة حتى الآن.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {attemptsWithDerived.map((a) => {
            const isExpanded = expandedId === a.id;
            const title = a.quizzes?.title || "امتحان";
            return (
              <div
                key={a.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId((prev) => (prev === a.id ? null : a.id))
                  }
                  className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString("ar-EG")
                        : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {a.score}/{a.total_questions}
                      {typeof a.time_taken_seconds === "number"
                        ? ` - ${a.time_taken_seconds}s`
                        : ""}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          بدأ في
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {a._startedAt ? a._startedAt.toLocaleString("ar-EG") : "-"}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          انتهى في
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {a._finishedAt
                            ? a._finishedAt.toLocaleString("ar-EG")
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                        الإجابات
                      </div>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg overflow-auto border border-gray-100 dark:border-gray-700">
                        {JSON.stringify(a.answers ?? [], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
