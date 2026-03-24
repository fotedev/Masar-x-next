"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { SubjectDashboard } from "@/components/subject/SubjectDashboard";
import { LectureDetailView } from "@/components/subject/LectureDetailView";
import { AddLectureModal } from "@/components/subject/AddLectureModal";
import { inferLectureKeyFromTitle } from "@/utils/lecture-inference";
import { useSubjectModals } from "@/hooks/useSubjectModals";
import { useLectureContent } from "@/hooks/useLectureContent";
import { useManageLectures } from "@/hooks/useManageLectures";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";
import type { ContentItem, LectureIndexItem } from "@/components/subject/lecture-detail/types";

interface SubjectLecture {
  id: string;
  lecture_key: string;
  lecture_label: string;
  order_index: number;
}

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("subjectPage");
  const { user, isAdmin } = useAuth();
  const locale = params.locale as string;
  const isRTL = locale === "ar";
  const lectureIdParam = params.lectureId as string | undefined;

  const {
    lectureFormData,
    setLectureFormData,
    showAddLectureForm,
    setShowAddLectureForm,
  } = useSubjectModals();

  const rawSubjectName = params.subject as string;
  const normalizedSubjectName = decodeURIComponent(rawSubjectName).replace(
    /-/g,
    " ",
  );

  const [loading, setLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] =
    useState<LectureIndexItem | null>(null);
  const [selectedLectureForContent, setSelectedLectureForContent] = useState<{
    id: string;
    lecture_key: string;
    lecture_label?: string | null;
  } | null>(null);
  const [subjectLectures, setSubjectLectures] = useState<SubjectLecture[]>([]);

  // Video and Progress State
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [completedContent, setCompletedContent] = useState<Set<string>>(
    new Set(),
  );

  const {
    handleAddLecture,
    loading: isSavingLecture,
    setNewLecture,
  } = useManageLectures({
    show: showAddLectureForm,
    subjectName: normalizedSubjectName,
    standardizedSubject: normalizedSubjectName,
  });

  const lecturesIndexForHook = useMemo(
    () =>
      subjectLectures.map((l) => ({
        id: l.id,
        title: l.lecture_label,
        lecture_key: l.lecture_key,
      })),
    [subjectLectures],
  );

  const { summaries, videos, files, quizzes } = useLectureContent({
    show: !!selectedLectureForContent,
    subject: normalizedSubjectName,
    lecture: selectedLectureForContent,
    lecturesIndex: lecturesIndexForHook,
  });

  const explanationItems = useMemo(
    () => [...summaries, ...videos],
    [summaries, videos],
  );

  const lectureIndex: LectureIndexItem[] = useMemo(() => {
    return subjectLectures.map((l) => ({
      key: l.lecture_key,
      label: l.lecture_label,
      order: l.order_index,
      counts: {
        summaries: 0,
        videos: 0,
        files: 0,
        exams: 0,
      },
    }));
  }, [subjectLectures]);

  const [dashboardData, setDashboardData] = useState({
    name: "",
    nameEn: "" as string | null,
    professor: "",
    professorAr: "" as string | null,
    professorGender: "male" as "male" | "female",
    description: "",
    descriptionAr: "" as string | null,
    progress: 0,
    schedule: "",
    nextLecture: "",
    totalLectures: "0/0",
  });

  const fetchSubjectData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch subject details
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("*")
        .eq("name", normalizedSubjectName)
        .single();

      if (subjectError) throw subjectError;

      if (subjectData) {
        setDashboardData({
          name: subjectData.name,
          nameEn: subjectData.name_en || null,
          professor: subjectData.professor || "",
          professorAr: subjectData.professor_ar || null,
          professorGender:
            (subjectData.professor_gender as "male" | "female") || "male",
          description: subjectData.description || "",
          descriptionAr: subjectData.description_ar || null,
          progress: 0, // This would normally be calculated from user progress
          schedule: subjectData.schedule || "",
          nextLecture: subjectData.location || "",
          totalLectures: "0/0",
        });

        // Fetch lectures for this subject
        const { data: lectures, error: lecturesError } = await supabase
          .from("subject_lectures")
          .select("*")
          .eq("subject", normalizedSubjectName)
          .order("order_index", { ascending: true });

        if (lecturesError) throw lecturesError;
        const fetchedLectures = (lectures || []) as SubjectLecture[];
        setSubjectLectures(fetchedLectures);

        // If lectureIdParam is present, select that lecture automatically
        if (lectureIdParam) {
          const targetLec = fetchedLectures.find(l => l.lecture_key === lectureIdParam);
          if (targetLec) {
            setSelectedLecture({
              key: targetLec.lecture_key,
              label: targetLec.lecture_label,
              order: targetLec.order_index,
              counts: { summaries: 0, videos: 0, files: 0, exams: 0 }
            });
            setSelectedLectureForContent({
              id: targetLec.id,
              lecture_key: targetLec.lecture_key,
              lecture_label: targetLec.lecture_label,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error fetching subject data", error);
      toast.error(t("errorLoadingSubject"));
    } finally {
      setLoading(false);
    }
  }, [normalizedSubjectName, t, lectureIdParam]);

  useEffect(() => {
    fetchSubjectData();
  }, [fetchSubjectData]);

  // Sync selected lecture when lectureIdParam changes (for browser back/forward)
  useEffect(() => {
    if (subjectLectures.length > 0) {
      if (lectureIdParam) {
        const targetLec = subjectLectures.find(l => l.lecture_key === lectureIdParam);
        if (targetLec && selectedLecture?.key !== lectureIdParam) {
          setSelectedLecture({
            key: targetLec.lecture_key,
            label: targetLec.lecture_label,
            order: targetLec.order_index,
            counts: { summaries: 0, videos: 0, files: 0, exams: 0 }
          });
          setSelectedLectureForContent({
            id: targetLec.id,
            lecture_key: targetLec.lecture_key,
            lecture_label: targetLec.lecture_label,
          });
        }
      } else {
        setSelectedLecture(null);
        setSelectedLectureForContent(null);
      }
    }
  }, [lectureIdParam, subjectLectures, selectedLecture?.key]);

  const totalPossibleItems = useMemo(() => {
    return lectureIndex.length;
  }, [lectureIndex]);

  // YouTube Utility
  const getYouTubeId = useCallback((url: string) => {
    const regExp =
      /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  }, []);

  // Fetch User Progress
  const fetchUserProgress = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("content_id")
        .eq("user_id", user.id);

      if (error) throw error;
      setCompletedContent(
        new Set((data || []).map((p: { content_id: string }) => p.content_id)),
      );
    } catch (error) {
      logger.error("Error fetching user progress", error);
    }
  }, [user]);

  useEffect(() => {
    fetchUserProgress();
  }, [fetchUserProgress]);

  // Handlers
  const handleToggleProgress = useCallback(
    async (contentId: string) => {
      if (!user) {
        toast.error(t("errors.mustLogin"));
        return;
      }

      const isCompleted = completedContent.has(contentId);
      const newCompleted = new Set(completedContent);

      try {
        if (isCompleted) {
          const { error } = await supabase
            .from("user_progress")
            .delete()
            .eq("user_id", user.id)
            .eq("content_id", contentId);
          if (error) throw error;
          newCompleted.delete(contentId);
        } else {
          const { error } = await supabase.from("user_progress").insert({
            user_id: user.id,
            content_id: contentId,
          });
          if (error) throw error;
          newCompleted.add(contentId);
        }
        setCompletedContent(newCompleted);
      } catch (error) {
        logger.error("Error toggling progress", error);
        toast.error(t("errors.updateProgressFailed"));
      }
    },
    [user, completedContent, t],
  );

  const handleViewContent = useCallback((item: ContentItem) => {
    if (item.type === "video") {
      setActiveVideoUrl(item.url || null);
      setActiveVideoTitle(item.title);
      // Scroll to top to see video player
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (item.file_url) {
      window.open(item.file_url, "_blank");
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {selectedLecture ? (
        <LectureDetailView
          isRTL={isRTL}
          locale={locale}
          isAdmin={isAdmin}
          user={user}
          subjectName={normalizedSubjectName}
          selectedLecture={selectedLecture}
          explanationItems={explanationItems}
          homeworkItems={files}
          examItems={quizzes}
          activeVideoUrl={activeVideoUrl}
          activeVideoTitle={activeVideoTitle}
          isTheatreMode={isTheatreMode}
          completedContent={completedContent}
          tSubjectPage={t}
          getYouTubeId={getYouTubeId}
          onBackToSubjects={() => router.push("/subjects")}
          onBackToLectures={() => {
            setSelectedLecture(null);
            setActiveVideoUrl(null);
          }}
          onToggleTheatreMode={() => setIsTheatreMode((prev) => !prev)}
          onCloseVideo={() => setActiveVideoUrl(null)}
          onToggleProgress={handleToggleProgress}
          onViewContent={handleViewContent}
          onAddVideo={() => {
            if (isAdmin) {
              router.push(
                `/subjects/${rawSubjectName}/admin?action=add-video&lecture=${selectedLecture?.key}`,
              );
            }
          }}
          onAddFile={() => {
            if (isAdmin) {
              router.push(
                `/subjects/${rawSubjectName}/admin?action=add-file&lecture=${selectedLecture?.key}`,
              );
            }
          }}
          onAddExam={() => {
            if (isAdmin) {
              router.push(
                `/subjects/${rawSubjectName}/admin?action=add-exam&lecture=${selectedLecture?.key}`,
              );
            }
          }}
        />
      ) : (
        <SubjectDashboard
          isRTL={isRTL}
          isAdmin={isAdmin}
          normalizedSubjectName={
            isRTL
              ? dashboardData.name
              : dashboardData.nameEn || dashboardData.name
          }
          dashboardData={dashboardData}
          lectureIndex={lectureIndex}
          totalPossibleItems={totalPossibleItems}
          tSubjectPage={t}
          onBackToSubjects={() => router.push("/subjects")}
          onEditSubject={() => {}} // Handle edit subject
          onAddLecture={() => setShowAddLectureForm(true)}
          onSelectLecture={(key) => {
            const lecUi = lectureIndex.find((l) => l.key === key);
            if (!lecUi) return;
            const lecDb = subjectLectures.find((l) => l.lecture_key === key);
            if (!lecDb) return;
            setSelectedLecture(lecUi);
            setSelectedLectureForContent({
              id: lecDb.id,
              lecture_key: lecDb.lecture_key,
              lecture_label: lecDb.lecture_label,
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {showAddLectureForm && (
        <AddLectureModal
          isOpen={showAddLectureForm}
          onClose={() => setShowAddLectureForm(false)}
          tSubjectPage={t}
          tCommon={t}
          lectureFormData={{
            title: lectureFormData.title,
            label: lectureFormData.label,
            key: lectureFormData.key,
            orderIndex: lectureFormData.orderIndex,
          }}
          setLectureFormData={(updater: (prev: typeof lectureFormData) => typeof lectureFormData) => setLectureFormData(updater)}
          getLectureInfoFromTitle={(title: string) => ({
            key:
              inferLectureKeyFromTitle(
                title,
                subjectLectures.map((l) => ({
                  id: l.id,
                  title: l.lecture_label,
                  lecture_key: l.lecture_key,
                })),
              ) || "other",
            label: title,
          })}
          isSavingLecture={isSavingLecture}
          onSaveLecture={async () => {
            setNewLecture({
              title: lectureFormData.title,
              orderIndex: lectureFormData.orderIndex,
            });
            await handleAddLecture();
            setShowAddLectureForm(false);
            fetchSubjectData();
          }}
          showMergeWarning={false}
          setShowMergeWarning={() => {}}
        />
      )}
    </div>
  );
}
