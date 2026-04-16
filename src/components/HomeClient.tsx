"use client";

import { useEffect, useMemo, useState } from "react";
import { SummariesSection } from "@/components/home/SummariesSection";
import { VideosSection } from "@/components/home/VideosSection";
import { QuizzesSection } from "@/components/home/QuizzesSection";
import { EditSummaryModal } from "@/components/EditSummaryModal";
import { useSummaries } from "@/hooks/useSummaries";
import { useSubjects } from "@/hooks/useSubjects";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import {
  SummaryWithRatings,
  Quiz,
  VideoWithRatings,
  Subject,
} from "@/types/database";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import { useTopVideos } from "@/hooks/useVideoRatings";
import { queryCache, cacheTTL } from "@/lib/queryCache";
import { 
  Sparkles, 
  History, 
  ArrowRight,
  BookOpen,
  PlayCircle,
  FileText
} from "lucide-react";

export default function HomeClient() {
  const tHome = useTranslations("home");
  const { user, isAdmin } = useAuth();
  const { summaries, editSummary, loading: summariesLoading } = useSummaries();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { activeSemester } = usePlatformSettings();
  const { trackSummaryClick } = useAnalytics();
  const { videos: topVideos, loading: videosLoading } = useTopVideos(10);
  const [displayQuizzes, setDisplayQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [editingSummary, setEditingSummary] =
    useState<SummaryWithRatings | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const onNavigate = (page: string, id?: string) => {
    if (id) {
      router.push(`/${locale}/${page}/${id}`);
    } else {
      router.push(`/${locale}/${page}`);
    }
  };

  const normalizeSubjectName = useMemo(() => (value: string) =>
    (value || "").trim().replace(/\s+/g, " "), []);

  const visibleSubjectSet = useMemo(() => {
    const names = (subjects as Subject[])
      .filter(
        (s) =>
          s.show_on_home &&
          (!s.semester || Number(s.semester) === activeSemester),
      )
      .map((s) => normalizeSubjectName(s.name));
    return new Set(names.filter(Boolean));
  }, [subjects, activeSemester, normalizeSubjectName]);

  const displaySummaries = useMemo(() => {
    const approvedSummaries = (summaries as SummaryWithRatings[]).filter(
      (s: SummaryWithRatings) =>
        s.status === "approved" && visibleSubjectSet.has(normalizeSubjectName(s.subject)),
    );

    const sortedSummaries = [...approvedSummaries].sort((a, b) => {
      const ratingA = a.avg_rating || 0;
      const ratingB = b.avg_rating || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return sortedSummaries.slice(0, 10);
  }, [summaries, visibleSubjectSet, normalizeSubjectName]);

  const displayVideos = useMemo(() => {
    const ratedVideos = (topVideos as VideoWithRatings[]).filter(
      (v) => visibleSubjectSet.has(normalizeSubjectName(v.subject)) && (v.avg_rating || 0) > 0,
    );

    const sortedVideos = [...ratedVideos].sort((a, b) => {
      const ratingA = a.avg_rating || 0;
      const ratingB = b.avg_rating || 0;
      return ratingB - ratingA;
    });

    return sortedVideos.slice(0, 10);
  }, [topVideos, visibleSubjectSet, normalizeSubjectName]);

  useEffect(() => {
    if (subjectsLoading) return;

    const loadQuizzes = async () => {
      try {
        setQuizzesLoading(true);

        const cacheKey = `home_quizzes_approved`;
        const cached = queryCache.get<Quiz[]>(cacheKey);
        
        let rows: Quiz[] = [];
        if (cached) {
          rows = cached;
        } else {
          const { data, error } = await supabase
            .from("quizzes")
            .select("*")
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(200);

          if (error) throw error;
          rows = (data || []) as Quiz[];
          queryCache.set(cacheKey, rows, cacheTTL.quizzes);
        }

        const filtered = rows.filter((q) => {
          let subject = (q.subject || "").toString();
          if (!subject) {
            try {
              const parsed = JSON.parse(q.description || "{}");
              if (typeof parsed?.subject === "string") {
                subject = parsed.subject;
              }
            } catch { /* ignore */ }
          }
          const normalizedQuizSubject = normalizeSubjectName(subject);
          return normalizedQuizSubject && visibleSubjectSet.has(normalizedQuizSubject);
        });

        const limited = filtered.slice(0, 10);
        
        setDisplayQuizzes(prev => {
          if (prev.length === limited.length && 
              prev.every((q, i) => q.id === limited[i].id)) {
            return prev;
          }
          return limited;
        });
      } catch {
        setDisplayQuizzes([]);
      } finally {
        setQuizzesLoading(false);
      }
    };

    loadQuizzes();
  }, [subjectsLoading, visibleSubjectSet, normalizeSubjectName]);

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
    <div className="space-y-10">
      {/* Quick Actions & Navigation Hub */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* ZANE AI Shortcut */}
        <div 
          onClick={() => onNavigate("ai-assistant")}
          className="md:col-span-5 relative group cursor-pointer overflow-hidden rounded-[32px] p-8 bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-800 text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-500 border border-white/10"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-colors" />
          <div className="relative z-10 h-full flex flex-col">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-8 h-8 text-cyan-300" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight">
              اسأل زين AI
            </h2>
            <p className="text-blue-100/90 font-medium mb-8 leading-relaxed text-sm sm:text-base">
              هل تواجه صعوبة في فهم موضوع معين؟ زين هنا لمساعدتك في المذاكرة وتلخيص المواد.
            </p>
            <div className="mt-auto flex items-center gap-2 font-bold text-sm bg-white/10 self-start px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
              <span>ابدأ المحادثة الآن</span>
              <ArrowRight className={`w-4 h-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="md:col-span-7 grid grid-cols-2 gap-4">
          <div 
            onClick={() => onNavigate("subjects")}
            className="modern-card p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-brand-blue/50 transition-all active:scale-95"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <BookOpen className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">المواد الدراسية</span>
          </div>

          <div 
            onClick={() => onNavigate("quizzes")}
            className="modern-card p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-purple-500/50 transition-all active:scale-95"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
              <PlayCircle className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">بنك الاختبارات</span>
          </div>

          <div 
            onClick={() => onNavigate("news")}
            className="modern-card p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-brand-orange/50 transition-all active:scale-95"
          >
            <div className="w-12 h-12 bg-brand-orange/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-orange transition-colors">
              <FileText className="w-6 h-6 text-brand-orange group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">آخر الأخبار</span>
          </div>

          <div 
            onClick={() => onNavigate("profile")}
            className="modern-card p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-emerald-500/50 transition-all active:scale-95"
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
              <History className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">نشاطك الأخير</span>
          </div>
        </div>
      </section>

      <SummariesSection
        loading={summariesLoading}
        subjectsLoading={subjectsLoading}
        displaySummaries={displaySummaries}
        tHome={tHome}
        onNavigate={onNavigate}
        trackSummaryClick={trackSummaryClick}
        user={user}
        isAdmin={isAdmin}
        onEditSummary={handleEditSummary}
      />

      <VideosSection
        loading={videosLoading}
        subjectsLoading={subjectsLoading}
        displayVideos={displayVideos}
        tHome={tHome}
        onNavigate={onNavigate}
      />

      <QuizzesSection
        loading={quizzesLoading}
        subjectsLoading={subjectsLoading}
        displayQuizzes={displayQuizzes}
        tHome={tHome}
        onNavigate={onNavigate}
      />

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />
    </div>
  );
}
