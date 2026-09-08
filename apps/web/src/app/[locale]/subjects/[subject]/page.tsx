"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useAnalytics } from "@/hooks/useAnalytics";
import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";
import { StudyWorkspace } from "@/components/desktop/workspace/StudyWorkspace";
import type { WorkspaceLecture } from "@/components/desktop/workspace/types";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type {
  ContentItem,
  LectureIndexItem,
} from "@/components/subject/lecture-detail/types";

interface SubjectLecture {
  id: string;
  lecture_key: string;
  lecture_label: string;
  order_index: number;
}

export default function SubjectPage() {
  const params = useParams();
  const rawSubjectName = (params?.subject as string) || "";
  const locale = (params?.locale as string) || "ar";
  const lectureIdParam = params?.lectureId as string | undefined;

  const router = useRouter();
  const t = useTranslations("subjectPage");
  const { user, isAdmin } = useAuth();
  const { trackEvent } = useAnalytics();
  const isRTL = locale === "ar";
  const isDesktop = useIsDesktopRuntime();

  const {
    lectureFormData,
    setLectureFormData,
    showAddLectureForm,
    setShowAddLectureForm,
  } = useSubjectModals();

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

  const { summaries, videos, files, quizzes, loading: contentLoading } =
    useLectureContent({
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
          const targetLec = fetchedLectures.find(
            (l) => l.lecture_key === lectureIdParam,
          );
          if (targetLec) {
            setSelectedLecture({
              key: targetLec.lecture_key,
              label: targetLec.lecture_label,
              order: targetLec.order_index,
              counts: { summaries: 0, videos: 0, files: 0, exams: 0 },
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
        const targetLec = subjectLectures.find(
          (l) => l.lecture_key === lectureIdParam,
        );
        if (targetLec && selectedLecture?.key !== lectureIdParam) {
          setSelectedLecture({
            key: targetLec.lecture_key,
            label: targetLec.lecture_label,
            order: targetLec.order_index,
            counts: { summaries: 0, videos: 0, files: 0, exams: 0 },
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
        // Surface the state change so the student has visible confirmation
        // (the toggle is otherwise silent — students can't tell if it stuck).
        toast.success(
          isCompleted
            ? t("progress.unmarked")
            : t("progress.markedComplete"),
        );
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

  // Shape the desktop workspace input from the subject lectures list.
  // Counts are zeroed here (the upstream subject fetch doesn't carry them);
  // the workspace sidebar renders only existing counts via `> 0` guards.
  const workspaceLectures: WorkspaceLecture[] = useMemo(
    () =>
      subjectLectures.map((l) => ({
        id: l.id,
        title: l.lecture_label,
        ordinal: l.order_index,
        lectureKey: l.lecture_key,
        documentUrl: undefined,
        counts: { summaries: 0, videos: 0, files: 0, quizzes: 0 },
      })),
    [subjectLectures],
  );

  // Workspace initial-id: prefer a lecture already open via the URL param;
  // otherwise the StudyWorkspace falls back to the first lecture.
  const workspaceInitialId = selectedLectureForContent?.id ?? null;

  // Active lecture with its first matching file URL attached, used by
  // the embedded reader. Without a lecture selected, documentUrl stays
  // undefined and the reader surfaces its no-document state.
  const activeWorkspaceLecture: WorkspaceLecture | null = useMemo(() => {
    if (!selectedLectureForContent) return null;
    const lec = workspaceLectures.find(
      (l) => l.id === selectedLectureForContent.id,
    );
    if (!lec) return null;
    const docFile = files.find((f) => !!f.file_url);
    if (!docFile?.file_url) return lec;
    return {
      ...lec,
      documentUrl: docFile.file_url,
      documentTitle: docFile.title,
    };
  }, [workspaceLectures, selectedLectureForContent, files]);

  const workspaceLecturesWithActiveDoc = useMemo(
    () =>
      activeWorkspaceLecture
        ? workspaceLectures.map((l) =>
            l.id === activeWorkspaceLecture.id ? activeWorkspaceLecture : l,
          )
        : workspaceLectures,
    [workspaceLectures, activeWorkspaceLecture],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh-safe">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  // Desktop surface — spec 005 study workspace (FR-001).
  // One window: lecture list / reader / assistant side by side.
  // The wrapper guarantees the workspace fills the available height below
  // the chrome; `flex-1` survives the outer Layout `flex-grow` so the
  // page never overflows the viewport. `min-h-0` lets the flex chain
  // shrink past its content height (per spec 005 acceptance #1).
  if (isDesktop) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col">
        <StudyWorkspace
          subjectName={normalizedSubjectName}
          lectures={workspaceLecturesWithActiveDoc}
          initialLectureId={workspaceInitialId ?? undefined}
          currentContent={{
            summaries,
            videos,
            files,
            quizzes,
          }}
          contentLoading={contentLoading}
          user={user}
          trackEvent={trackEvent}
        />
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
          onBackToSubjects={() => router.push(`/${locale}/subjects`)}
          onBackToLectures={() => {
            router.push(`/${locale}/subjects/${rawSubjectName}`, {
              scroll: false,
            });
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
                `/${locale}/subjects/${rawSubjectName}/admin?action=add-video&lecture=${selectedLecture?.key}`,
              );
            }
          }}
          onAddFile={() => {
            if (isAdmin) {
              router.push(
                `/${locale}/subjects/${rawSubjectName}/admin?action=add-file&lecture=${selectedLecture?.key}`,
              );
            }
          }}
          onAddExam={() => {
            if (isAdmin) {
              router.push(
                `/${locale}/subjects/${rawSubjectName}/admin?action=add-exam&lecture=${selectedLecture?.key}`,
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
          tSubjectPage={t}
          onBackToSubjects={() => router.push(`/${locale}/subjects`)}
          onEditSubject={() => {}} // Handle edit subject
          onAddLecture={() => setShowAddLectureForm(true)}
          onSelectLecture={(key) => {
            const lecUi = lectureIndex.find((l) => l.key === key);
            if (!lecUi) return;
            const lecDb = subjectLectures.find((l) => l.lecture_key === key);
            if (!lecDb) return;

            // Update URL to include the lecture ID for persistence and proper routing
            router.push(
              `/${locale}/subjects/${rawSubjectName}/lectures/${key}`,
              { scroll: false },
            );

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
          setLectureFormData={(
            updater: (prev: typeof lectureFormData) => typeof lectureFormData,
          ) => setLectureFormData(updater)}
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
