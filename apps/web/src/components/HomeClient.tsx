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
import { Link } from '@/navigation';
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
  FileText,
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
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {/* ZANE AI Shortcut */}
        <Link
          href="/ai-assistant"
          aria-label={tHome("aiCardTitle")}
          className="lg:col-span-5 relative group cursor-pointer overflow-hidden rounded-[28px] p-6 sm:p-7 bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-800 text-primary-foreground shadow-lg shadow-indigo-950/20 dark:shadow-indigo-950/40 hover:shadow-xl hover:shadow-indigo-900/30 transition-[colors,transform,box-shadow] duration-300 border border-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none text-left rtl:text-right flex flex-col justify-between h-full"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-2xl group-hover:bg-white/15 transition-colors pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 border border-white/20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-cyan-300" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-2.5 tracking-tight flex items-center gap-1.5 flex-wrap">
                {locale === "ar" ? (
                  <>
                    <span>اسأل زين</span>
                    <bdi className="font-sans font-black tracking-normal">AI</bdi>
                  </>
                ) : (
                  tHome("aiCardTitle")
                )}
              </h2>
              <p
                className="text-blue-100/90 font-medium leading-relaxed text-sm text-left rtl:text-right"
                dir={locale === "ar" ? "rtl" : "ltr"}
              >
                {tHome("aiCardDescription")}
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 font-bold text-sm bg-white/10 self-start px-4 py-2 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
              <span>{tHome("aiCardCta")}</span>
              <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </Link>

        {/* Action Grid */}
        <div className="lg:col-span-7 grid grid-cols-2 grid-rows-2 gap-4 h-full">
          <Link
            href="/subjects"
            aria-label={tHome("actionSubjects")}
            className="modern-card p-5 sm:p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-brand-blue/50 transition-[colors,transform,box-shadow] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-[28px] h-full"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
              <BookOpen className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors">
              {tHome("actionSubjects")}
            </span>
          </Link>

          <Link
            href="/quizzes"
            aria-label={tHome("actionQuizzes")}
            className="modern-card p-5 sm:p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-purple-500/50 transition-[colors,transform,box-shadow] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-[28px] h-full"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-purple-600 transition-colors">
              <PlayCircle className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
              {tHome("actionQuizzes")}
            </span>
          </Link>

          <Link
            href="/news"
            aria-label={tHome("actionNews")}
            className="modern-card p-5 sm:p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-brand-orange/50 transition-[colors,transform,box-shadow] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-[28px] h-full"
          >
            <div className="w-12 h-12 bg-brand-orange/10 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-brand-orange transition-colors">
              <FileText className="w-6 h-6 text-brand-orange group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-brand-orange transition-colors">
              {tHome("actionNews")}
            </span>
          </Link>

          <Link
            href="/profile"
            aria-label={tHome("actionActivity")}
            className="modern-card p-5 sm:p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-emerald-500/50 transition-[colors,transform,box-shadow] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-[28px] h-full"
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-emerald-600 transition-colors">
              <History className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
              {tHome("actionActivity")}
            </span>
          </Link>
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
