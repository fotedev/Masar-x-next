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
    <div className="space-y-8">
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
