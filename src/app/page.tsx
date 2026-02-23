"use client";

import { useEffect, useState } from "react";
import { FileText, Calendar, BookOpen, Star } from "lucide-react";
import { useSummaries } from "../hooks/useSummaries";
import { useSubjects } from "../hooks/useSubjects";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { EditSummaryModal } from "../components/EditSummaryModal";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { SummaryWithRatings, Quiz } from "../types/database";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const { summaries, editSummary, loading: summariesLoading } = useSummaries();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { activeSemester } = usePlatformSettings();
  const { trackSummaryClick } = useAnalytics();
  const [displaySummaries, setDisplaySummaries] = useState<
    SummaryWithRatings[]
  >([]);
  const [displayQuizzes, setDisplayQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [editingSummary, setEditingSummary] =
    useState<SummaryWithRatings | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const router = useRouter();

  const onNavigate = (page: string, id?: string) => {
    if (id) {
      router.push(`/${page}/${id}`);
    } else {
      router.push(`/${page}`);
    }
  };

  useEffect(() => {
    // Filter summaries by approval status AND subject visibility AND active semester
    const visibleSubjectNames = subjects
      .filter(
        (s) =>
          s.show_on_home &&
          (!s.semester || Number(s.semester) === activeSemester),
      )
      .map((s) => s.name);

    const approvedSummaries = summaries.filter(
      (s) => s.status === "approved" && visibleSubjectNames.includes(s.subject),
    );
    setDisplaySummaries(approvedSummaries);
  }, [summaries, subjects, activeSemester]);

  useEffect(() => {
    const normalizeSubjectName = (value: string) =>
      (value || "").trim().replace(/\s+/g, " ");

    const visibleSubjectNames = subjects
      .filter(
        (s) =>
          s.show_on_home &&
          (!s.semester || Number(s.semester) === activeSemester),
      )
      .map((s) => s.name);
    const visibleSubjectSet = new Set(
      visibleSubjectNames.map((n) => normalizeSubjectName(n)).filter(Boolean),
    );

    if (subjectsLoading) return;

    const loadQuizzes = async () => {
      try {
        setQuizzesLoading(true);

        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        const rows = (data || []) as Quiz[];

        const filtered = rows.filter((q) => {
          let subject = (q.subject || "").toString();

          if (!subject) {
            try {
              const parsed = JSON.parse(q.description || "{}");
              if (typeof parsed?.subject === "string") {
                subject = parsed.subject;
              }
            } catch {
              // ignore
            }
          }

          const normalizedQuizSubject = normalizeSubjectName(subject);
          if (!normalizedQuizSubject) return false;
          return visibleSubjectSet.has(normalizedQuizSubject);
        });

        setDisplayQuizzes(filtered);
      } catch {
        setDisplayQuizzes([]);
      } finally {
        setQuizzesLoading(false);
      }
    };

    loadQuizzes();
  }, [subjects, subjectsLoading]);

  const handleEditSummary = (summary: SummaryWithRatings) => {
    setEditingSummary(summary);
    setShowEditModal(true);
  };

  const handleSaveSummary = async (
    id: string,
    updates: Record<string, unknown>,
  ) => {
    await editSummary(id, updates);
    setShowEditModal(false);
    setEditingSummary(null);
  };

  return (
    <div className="space-y-8">
      {/* All Summaries Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            الأفضل
          </h2>
          <button
            onClick={() => onNavigate("subjects")}
            className="text-brand-blue hover:text-brand-sky text-sm font-semibold transition-colors flex items-center gap-1"
          >
            عرض المواد
            <span className="text-lg">←</span>
          </button>
        </div>
        {summariesLoading || subjectsLoading ? (
          <div className="modern-card p-12 text-center loading-placeholder">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              جاري التحميل ...
            </p>
          </div>
        ) : displaySummaries.length === 0 ? (
          <div className="modern-card p-12 text-center">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              اذهب للمواد
            </p>
          </div>
        ) : (
          <div className="summary-grid">
            {displaySummaries.map((summary: SummaryWithRatings) => {
              const canEdit = user && (isAdmin || summary.user_id === user.id);

              return (
                <div
                  key={summary.id}
                  className="modern-card p-5 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
                  onClick={() => {
                    trackSummaryClick(summary.id, "trending_click");
                    onNavigate("summaries", summary.id);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-brand-blue transition-colors">
                      {summary.title}
                    </h3>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSummary(summary);
                        }}
                        className="text-slate-400 hover:text-brand-blue p-1.5 rounded-lg hover:bg-brand-blue/5 transition-all"
                        title="تعديل الملخص"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
                        <span className="truncate">{summary.subject}</span>
                      </div>
                      {summary.avg_rating != null && summary.avg_rating > 0 && (
                        <div className="flex items-center gap-1 bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          <Star className="w-3 h-3 fill-brand-orange" />
                          <span>{summary.avg_rating}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                      <span className="truncate">
                        {summary.year} - {summary.department}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {summary.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            الامتحانات
          </h2>
          <button
            onClick={() => onNavigate("quizzes")}
            className="text-brand-blue hover:text-brand-sky text-sm font-semibold transition-colors flex items-center gap-1"
          >
            عرض الامتحانات
            <span className="text-lg">←</span>
          </button>
        </div>

        {subjectsLoading || quizzesLoading ? (
          <div className="modern-card p-12 text-center loading-placeholder">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              جاري التحميل ...
            </p>
          </div>
        ) : displayQuizzes.length === 0 ? (
          <div className="modern-card p-12 text-center">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              اذهب للامتحانات
            </p>
          </div>
        ) : (
          <div className="summary-grid">
            {displayQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="modern-card p-5 cursor-pointer group hover:border-brand-blue/50 transition-all duration-300"
                onClick={() => onNavigate("quiz-play", quiz.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-brand-blue transition-colors">
                    {quiz.title}
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
                      <span className="truncate">
                        {(() => {
                          try {
                            const parsed = JSON.parse(quiz.description || "{}");
                            return parsed.subject || quiz.subject || "عام";
                          } catch {
                            return quiz.subject || "عام";
                          }
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                    <span className="truncate">
                      {(() => {
                        try {
                          const parsed = JSON.parse(quiz.description || "{}");
                          const dept =
                            parsed.department || (quiz as any).department;
                          const year = parsed.year || (quiz as any).year;
                          return (
                            `${year || ""}${dept ? ` - ${dept}` : ""}`.trim() ||
                            ""
                          );
                        } catch {
                          const anyQ = quiz as any;
                          return (
                            `${anyQ.year || ""}${anyQ.department ? ` - ${anyQ.department}` : ""}`.trim() ||
                            ""
                          );
                        }
                      })()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {(() => {
                      try {
                        const parsed = JSON.parse(quiz.description || "{}");
                        return parsed.description || "";
                      } catch {
                        return "";
                      }
                    })()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />
    </div>
  );
}
