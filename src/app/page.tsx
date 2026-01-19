'use client';

import { useEffect, useState } from "react";
import { FileText, Calendar, BookOpen, Star } from "lucide-react";
import { useSummaries } from "../hooks/useSummaries";
import { useSubjects } from "../hooks/useSubjects";
import { useAuth } from "../contexts/AuthContext";
import { useAnalytics } from "../hooks/useAnalytics";
import { EditSummaryModal } from "../components/EditSummaryModal";
import { SummaryWithRatings } from "../types/database";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const { summaries, editSummary, loading: summariesLoading } = useSummaries();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { trackSummaryClick } = useAnalytics();
  const [displaySummaries, setDisplaySummaries] = useState<SummaryWithRatings[]>([]);
  const [editingSummary, setEditingSummary] = useState<SummaryWithRatings | null>(null);
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
    // Filter summaries by approval status AND subject visibility
    const visibleSubjectNames = subjects
      .filter((s) => s.show_on_home)
      .map((s) => s.name);

    const approvedSummaries = summaries.filter(
      (s) => s.status === "approved" && visibleSubjectNames.includes(s.subject)
    );
    setDisplaySummaries(approvedSummaries);
  }, [summaries, subjects]);

  const handleEditSummary = (summary: SummaryWithRatings) => {
    setEditingSummary(summary);
    setShowEditModal(true);
  };

  const handleSaveSummary = async (id: string, updates: any) => {
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
              جاري تحميل الملخصات...
            </p>
          </div>
        ) : displaySummaries.length === 0 ? (
          <div className="modern-card p-12 text-center">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              لا توجد ملخصات معتمدة للمواد المفعلة حالياً
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
                      {summary.avg_rating > 0 && (
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

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />
    </div>
  );
}
