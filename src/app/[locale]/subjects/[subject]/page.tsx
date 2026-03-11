"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSummaries } from "@/hooks/useSummaries";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { EditSummaryModal } from "@/components/EditSummaryModal";
import { AddSubjectModal } from "@/components/AddSubjectModal";
import { AddLectureModal } from "@/components/subject/AddLectureModal";
import { AddExamModal } from "@/components/subject/AddExamModal";
import { supabase } from "@/lib/supabase";
import { Quiz, Summary } from "@/types/database";
import { useVideos } from "@/hooks/useVideos";
import { useFiles } from "@/hooks/useFiles";
import { Suspense } from "react";
import { toast } from "sonner";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { queryCache, cacheKeys, cacheTTL } from "@/lib/queryCache";
import {
  useSubjectLectureInference,
  type SubjectLectureRow,
} from "@/hooks/useSubjectLectureInference";
import { SubjectDashboard } from "@/components/subject/SubjectDashboard";
import { LectureDetailView } from "@/components/subject/LectureDetailView";

import { motion, AnimatePresence } from "framer-motion";
import { useSubjectModals } from "@/hooks/useSubjectModals";
import { Skeleton } from "@/components/ui/Skeleton";

function SubjectPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-6">
              <div className="modern-card p-6 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-2/3 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="modern-card p-6">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectSummariesContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectId = (params?.subject as string) || searchParams?.get("subject");
  const lectureFromQuery = searchParams?.get("lecture");
  const router = useRouter();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const tCommon = useTranslations("common");
  const tSubjectPage = useTranslations("subjectPage");
  const { user, isAdmin } = useAuth();

  const {
    levels,
    getDepartmentsForLevelName,
    loading: academicOptionsLoading,
  } = useAcademicOptions({ includeInactive: true });
  const summariesHook = useSummaries();
  const { trackSummaryClick } = useAnalytics();
  const {
    editingSummary,
    setEditingSummary,
    showEditModal,
    setShowEditModal,
    showAddLectureForm,
    setShowAddLectureForm,
    showEditSubjectModal,
    setShowEditSubjectModal,
    showAddExamForm,
    setShowAddExamForm,
    lectureFormData,
    setLectureFormData,
    examFormData,
    setExamFormData,
  } = useSubjectModals();

  const [filteredSummaries, setFilteredSummaries] = useState<Summary[]>([]);
  const [savedLectures, setSavedLectures] = useState<SubjectLectureRow[]>([]);
  const [selectedLectureKey, setSelectedLectureKey] = useState<string | null>(
    null,
  );

  const [isSavingLecture, setIsSavingLecture] = useState(false);
  const [showMergeWarning, setShowMergeWarning] = useState(false);
  const [subjectQuizzes, setSubjectQuizzes] = useState<Quiz[]>([]);
  const [isSavingExam, setIsSavingExam] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const getYouTubeId = (url: string) => {
    // Standard YouTube and Shorts regex
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const availableExamDepartments = useMemo(() => {
    if (!examFormData.year) return [];
    return getDepartmentsForLevelName(examFormData.year);
  }, [examFormData.year, getDepartmentsForLevelName]);

  const subjectName = subjectId ? decodeURIComponent(subjectId) : "";

  const normalizedSubjectName = useMemo(
    () => subjectName.trim(),
    [subjectName],
  );

  const [subjectDetails, setSubjectDetails] = useState<any>(null);
  const [completedContent, setCompletedContent] = useState<Set<string>>(
    new Set(),
  );

  const { videos } = useVideos(normalizedSubjectName);
  const { files } = useFiles(normalizedSubjectName);

  useEffect(() => {
    async function fetchSubjectDetails() {
      if (!normalizedSubjectName) return;

      // Check cache first
      const cacheKey = cacheKeys.subjectDetails(normalizedSubjectName);
      const cached = queryCache.get<any>(cacheKey);
      if (cached) {
        setSubjectDetails(cached);
        return;
      }

      try {
        const { data } = await supabase
          .from("subjects")
          .select(
            "id, name, name_en, professor, professor_ar, professor_gender, description, description_ar, schedule, location, level, semester, status, show_on_home, created_at",
          )
          .eq("name", normalizedSubjectName)
          .maybeSingle();

        if (data) {
          setSubjectDetails(data);
          queryCache.set(cacheKey, data, cacheTTL.subjects);
        }
      } catch (error) {
        // console.error("Error fetching subject details:", error);
      }
    }
    fetchSubjectDetails();
  }, [normalizedSubjectName]);

  useEffect(() => {
    async function fetchProgress() {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("user_progress")
          .select("content_id")
          .eq("user_id", user.id);

        if (data) {
          setCompletedContent(new Set(data.map((d: any) => d.content_id)));
        }
      } catch (error) {
        // console.error("Error fetching progress:", error);
      }
    }
    fetchProgress();
  }, [user]);

  const totalPossibleItems = useMemo(() => {
    return (
      filteredSummaries.length +
      videos.length +
      files.length +
      subjectQuizzes.length
    );
  }, [filteredSummaries, videos, files, subjectQuizzes]);

  const progressPercentage = useMemo(() => {
    if (totalPossibleItems === 0) return 0;
    return Math.round((completedContent.size / totalPossibleItems) * 100);
  }, [completedContent.size, totalPossibleItems]);

  const dashboardData = {
    professor:
      locale === "ar" && subjectDetails?.professor_ar
        ? subjectDetails.professor_ar
        : subjectDetails?.professor || tCommon("loading"),
    professorGender: subjectDetails?.professor_gender || "male",
    description:
      locale === "ar" && subjectDetails?.description_ar
        ? subjectDetails.description_ar
        : subjectDetails?.description || tSubjectPage("descriptionWillAppear"),
    progress: progressPercentage,
    schedule: subjectDetails?.schedule || tSubjectPage("unknown"),
    nextLecture: subjectDetails?.location || tSubjectPage("unknown"),
    totalLectures: `${completedContent.size}/${totalPossibleItems}`,
  };

  const isLectureView = useMemo(() => {
    return Boolean((lectureFromQuery || "").trim());
  }, [lectureFromQuery]);

  const { getLectureInfoFromTitle } = useSubjectLectureInference({
    savedLectures,
    tSubjectPage,
  });

  const fetchSubjectLectures = useCallback(async () => {
    if (!normalizedSubjectName) {
      setSavedLectures([]);
      return;
    }

    // Check cache first
    const cacheKey = cacheKeys.subjectLectures(normalizedSubjectName);
    const cached = queryCache.get<any[]>(cacheKey);
    if (cached) {
      setSavedLectures(cached);
      return;
    }

    try {
      const decodedName = decodeURIComponent(normalizedSubjectName).trim();
      const normalizedQuery = decodedName.replace(/\s+/g, " ");

      const { data, error } = await supabase
        .from("subject_lectures")
        .select("*")
        .or(
          `subject.ilike.%${normalizedQuery}%,subject.ilike.%${decodedName}%,subject.ilike.%${normalizedSubjectName}%`,
        )
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      const lectures = (data || []) as Array<{
        id: string;
        subject: string;
        lecture_key: string;
        lecture_label: string;
        order_index: number;
        created_at: string;
        updated_at: string;
      }>;

      setSavedLectures(lectures);
      queryCache.set(cacheKey, lectures, cacheTTL.lectures);
    } catch {
      setSavedLectures([]);
    }
  }, [normalizedSubjectName]);

  useEffect(() => {
    fetchSubjectLectures();
  }, [fetchSubjectLectures]);

  const handleSaveLecture = async (force = false) => {
    if (!user) {
      toast.error(tSubjectPage("errors.mustLogin"));
      return;
    }

    if (!isAdmin) {
      toast.error(tSubjectPage("errors.notAuthorized"));
      return;
    }

    const rawTitle = (lectureFormData.title || "").trim();
    if (!rawTitle) {
      toast.error(tSubjectPage("errors.enterLectureName"));
      return;
    }

    try {
      setIsSavingLecture(true);

      const inferred = getLectureInfoFromTitle(rawTitle);
      const key = (inferred.key || "other")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "");

      if (!key) {
        toast.error(tSubjectPage("errors.autoLectureKeyFailed"));
        return;
      }

      // Check for existing lecture with same key unless forced
      if (!force) {
        const { data: existing } = await supabase
          .from("subject_lectures")
          .select("id")
          .eq(
            "subject",
            decodeURIComponent(normalizedSubjectName)
              .trim()
              .replace(/\s+/g, " "),
          )
          .eq("lecture_key", key)
          .maybeSingle();

        if (existing) {
          setShowMergeWarning(true);
          setIsSavingLecture(false);
          return;
        }
      }

      const manualLabel = (lectureFormData.label || "").trim();
      const label = manualLabel || inferred.label || rawTitle;

      const orderIndexNum = lectureFormData.orderIndex
        ? Number(lectureFormData.orderIndex)
        : inferred.order;
      const orderIndex =
        typeof orderIndexNum === "number" &&
        Number.isFinite(orderIndexNum) &&
        orderIndexNum >= 0
          ? Math.floor(orderIndexNum)
          : 999999;

      const standardizedSubject = decodeURIComponent(normalizedSubjectName)
        .trim()
        .replace(/\s+/g, " ");

      const { error } = await supabase.from("subject_lectures").upsert(
        {
          subject: standardizedSubject,
          lecture_key: key,
          lecture_label: label,
          order_index: orderIndex,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "subject,lecture_key" },
      );

      if (error) throw error;

      // Invalidate cache
      queryCache.invalidate(cacheKeys.subjectLectures(normalizedSubjectName));

      await fetchSubjectLectures();
      setShowAddLectureForm(false);
      setShowMergeWarning(false);
      setLectureFormData({ title: "", label: "", key: "", orderIndex: "" });

      setSelectedLectureKey(key);
    } catch {
      toast.error(tSubjectPage("errors.addLectureFailed"));
    } finally {
      setIsSavingLecture(false);
    }
  };

  useEffect(() => {
    const subjectSummaries = summariesHook.summaries
      .filter(
        (summary) =>
          summary.status === "approved" &&
          summary.subject === normalizedSubjectName,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    setFilteredSummaries(subjectSummaries);
  }, [summariesHook.summaries, normalizedSubjectName]);

  const lectureIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        order: number;
        counts: {
          summaries: number;
          videos: number;
          files: number;
          exams: number;
        };
      }
    >();

    const bump = (
      key: string,
      label: string,
      order: number,
      field: "summaries" | "videos" | "files" | "exams",
    ) => {
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          label,
          order,
          counts: { summaries: 0, videos: 0, files: 0, exams: 0 },
        });
      }
      const item = map.get(key)!;
      item.counts[field] += 1;
      if (order < item.order) item.order = order;
      if (
        item.label === tSubjectPage("uncategorized") &&
        label !== tSubjectPage("uncategorized")
      )
        item.label = label;
    };

    savedLectures.forEach((l) => {
      const key = (l.lecture_key || "").trim() || "other";
      const label =
        (l.lecture_label || "").trim() || tSubjectPage("uncategorized");
      const order =
        typeof l.order_index === "number" && Number.isFinite(l.order_index)
          ? l.order_index
          : 999999;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          order,
          counts: { summaries: 0, videos: 0, files: 0, exams: 0 },
        });
      } else {
        const existing = map.get(key)!;
        if (
          existing.label === tSubjectPage("uncategorized") &&
          label !== tSubjectPage("uncategorized")
        )
          existing.label = label;
        if (order < existing.order) existing.order = order;
      }
    });

    filteredSummaries.forEach((s) => {
      const info = getLectureInfoFromTitle(s.title);
      bump(info.key, info.label, info.order, "summaries");
    });

    videos.forEach((v) => {
      const info = getLectureInfoFromTitle(v.title);
      bump(info.key, info.label, info.order, "videos");
    });

    files.forEach((f) => {
      const info = getLectureInfoFromTitle(f.title);
      bump(info.key, info.label, info.order, "files");
    });

    subjectQuizzes.forEach((q) => {
      const info = getLectureInfoFromTitle(q.title, q.description || undefined);
      bump(info.key, info.label, info.order, "exams");
    });

    const arr = Array.from(map.values()).sort((a, b) => {
      if (a.key === "other" && b.key !== "other") return 1;
      if (b.key === "other" && a.key !== "other") return -1;
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label, "ar");
    });

    if (arr.length === 0) {
      return [];
    }
    return arr;
  }, [filteredSummaries, files, savedLectures, subjectQuizzes, videos]);

  useEffect(() => {
    if (!isLectureView) {
      setSelectedLectureKey(null);
      return;
    }

    const normalized = (lectureFromQuery || "").trim();
    if (!normalized) return;

    setSelectedLectureKey(normalized);
  }, [isLectureView, lectureFromQuery]);

  const selectedLecture = useMemo(() => {
    if (!selectedLectureKey) return null;
    return lectureIndex.find((l) => l.key === selectedLectureKey) || null;
  }, [lectureIndex, selectedLectureKey]);

  const selectedLectureId = useMemo(() => {
    if (!selectedLectureKey) return null;
    const match = savedLectures.find(
      (l) => l.lecture_key === selectedLectureKey,
    );
    return match?.id || null;
  }, [savedLectures, selectedLectureKey]);

  const lectureFilteredSummaries = useMemo(() => {
    const key = selectedLectureKey || "other";

    if (selectedLectureId) {
      return filteredSummaries.filter(
        (s: any) => s.lecture_id === selectedLectureId,
      );
    }

    return filteredSummaries.filter((s) => {
      if (s.lecture_key) return s.lecture_key === key;
      return getLectureInfoFromTitle(s.title).key === key;
    });
  }, [filteredSummaries, selectedLectureId, selectedLectureKey]);

  const lectureFilteredVideos = useMemo(() => {
    const key = selectedLectureKey || "other";

    if (selectedLectureId) {
      return videos.filter((v: any) => v.lecture_id === selectedLectureId);
    }

    return videos.filter((v) => {
      if (v.lecture_key) return v.lecture_key === key;
      return getLectureInfoFromTitle(v.title).key === key;
    });
  }, [selectedLectureId, selectedLectureKey, videos]);

  const lectureFilteredFiles = useMemo(() => {
    const key = selectedLectureKey || "other";

    if (selectedLectureId) {
      return files.filter((f: any) => f.lecture_id === selectedLectureId);
    }

    return files.filter((f) => {
      if (f.lecture_key) return f.lecture_key === key;
      return getLectureInfoFromTitle(f.title).key === key;
    });
  }, [files, selectedLectureId, selectedLectureKey]);

  const lectureFilteredQuizzes = useMemo(() => {
    const key = selectedLectureKey || "other";

    if (selectedLectureId) {
      return subjectQuizzes.filter(
        (q: any) => q.lecture_id === selectedLectureId,
      );
    }

    return subjectQuizzes.filter((q) => {
      if (q.description && q.description.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(q.description);
          if (parsed.lecture_key) return parsed.lecture_key === key;
        } catch {
          // ignore
        }
      }
      return (
        getLectureInfoFromTitle(q.title, q.description || undefined).key === key
      );
    });
  }, [selectedLectureId, selectedLectureKey, subjectQuizzes, savedLectures]);

  const fetchSubjectQuizzes = useCallback(
    async (skipCache = false) => {
      if (!normalizedSubjectName) return;

      const cacheKey = `quizzes_${normalizedSubjectName}_admin_${isAdmin}`;
      if (!skipCache) {
        const cached = queryCache.get<Quiz[]>(cacheKey);
        if (cached) {
          setSubjectQuizzes(cached);
          return;
        }
      }

      try {
        let query = supabase.from("quizzes").select("*");
        if (!isAdmin) query = query.eq("status", "approved");

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) throw error;

        const rows = (data || []) as Quiz[];

        const filteredQuizzes = rows.filter((q) => {
          const directSubject = q.subject;
          if (directSubject && directSubject.trim() === normalizedSubjectName)
            return true;

          const desc = q.description;
          if (!desc || !desc.trim().startsWith("{")) return false;

          try {
            const parsed = JSON.parse(desc);
            return (
              typeof parsed?.subject === "string" &&
              parsed.subject.trim() === normalizedSubjectName
            );
          } catch {
            return false;
          }
        });

        setSubjectQuizzes(filteredQuizzes as Quiz[]);
        queryCache.set(cacheKey, filteredQuizzes, cacheTTL.quizzes || 1800000);
      } catch {
        // ignore
      }
    },
    [isAdmin, normalizedSubjectName],
  );

  useEffect(() => {
    fetchSubjectQuizzes();
  }, [fetchSubjectQuizzes]);

  useEffect(() => {
    if (showAddExamForm && subjectDetails) {
      const inferredYear = (() => {
        const raw = (subjectDetails as any).level;

        if (typeof raw === "string") return raw;

        if (typeof raw === "number") {
          const match = levels.find((l) => l.level_number === raw);
          return match?.name || String(raw);
        }

        if (raw == null) return "";
        return String(raw);
      })();

      setExamFormData((p) => ({
        ...p,
        year: inferredYear,
        department: subjectDetails.semester || "", // Or handle department appropriately if it exists in subjectDetails
      }));
    }
  }, [levels, showAddExamForm, subjectDetails]);

  const handleSaveExam = async () => {
    if (!user) {
      toast.error(tSubjectPage("errors.mustLogin"));
      return;
    }

    try {
      setIsSavingExam(true);

      const durationMinutesNum = examFormData.durationMinutes
        ? Number(examFormData.durationMinutes)
        : null;
      const durationSeconds =
        typeof durationMinutesNum === "number" &&
        !Number.isNaN(durationMinutesNum) &&
        durationMinutesNum > 0
          ? Math.round(durationMinutesNum * 60)
          : null;

      const descriptionData = {
        description: examFormData.description,
        department: examFormData.department,
        year: examFormData.year,
        subject: normalizedSubjectName,
        lecture_key: selectedLectureKey || null,
      };

      const quizTitle = selectedLecture
        ? `[${selectedLecture.label}] ${examFormData.title.trim()}`
        : examFormData.title.trim();

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quizTitle,
          description: JSON.stringify(descriptionData),
          summary_id: null,
          user_id: user.id,
          source_type: "manual",
          duration_seconds: durationSeconds,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = examFormData.questions.map((q, index) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        image_url: null,
        order_index: index,
      }));

      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      await fetchSubjectQuizzes(true);
      toast.success(tSubjectPage("exam.saveSuccessTitle"), {
        description: tSubjectPage("exam.saveSuccessDescription"),
      });
      setShowAddExamForm(false);
      setExamFormData({
        title: "",
        description: "",
        durationMinutes: "",
        department: "",
        year: "",
        questions: [
          {
            question: "",
            options: ["", "", "", ""],
            correctAnswer: 0,
            explanation: "",
          },
        ],
      });
    } catch (error: any) {
      // console.error("Error saving exam:", error);
      toast.error(tSubjectPage("exam.saveErrorTitle"), {
        description: error.message || tSubjectPage("exam.saveErrorDescription"),
      });
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleSaveSummary = async (
    id: string,
    updates: Record<string, unknown>,
  ) => {
    await summariesHook.editSummary(id, updates);
    setShowEditModal(false);
    setEditingSummary(null);
  };

  const handleUpdateSubject = async (updatedData: any) => {
    if (!subjectDetails?.id) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .update(updatedData)
        .eq("id", subjectDetails.id);

      if (error) throw error;

      // Update local state immediately
      setSubjectDetails({ ...subjectDetails, ...updatedData });

      // Invalidate cache
      queryCache.invalidate(cacheKeys.subjectDetails(normalizedSubjectName));

      setShowEditSubjectModal(false);
      toast.success(tSubjectPage("subject.updateSuccessTitle"), {
        description: tSubjectPage("subject.updateSuccessDescription"),
      });
    } catch (error: any) {
      // console.error("Error updating subject:", error);
      toast.error(tSubjectPage("subject.updateErrorTitle"), {
        description:
          error.message || tSubjectPage("subject.updateErrorDescription"),
      });
    }
  };

  const toggleProgress = async (contentId: string) => {
    if (!user) return;

    const isCompleted = completedContent.has(contentId);
    try {
      if (isCompleted) {
        await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", contentId);

        setCompletedContent((prev) => {
          const next = new Set(prev);
          next.delete(contentId);
          return next;
        });
      } else {
        await supabase.from("user_progress").insert({
          user_id: user.id,
          content_id: contentId,
        });

        setCompletedContent((prev) => {
          const next = new Set(prev);
          next.add(contentId);
          return next;
        });
      }
    } catch (error) {
      // console.error("Error updating progress:", error);
    }
  };

  const homeworkKeyword = tSubjectPage("homework");

  const groupContentBySection = () => {
    const explanationItems: any[] = [
      ...lectureFilteredVideos.map((v) => ({ ...v, type: "video" })),
      ...lectureFilteredFiles
        .filter((f) => !f.title.includes(homeworkKeyword))
        .map((f) => ({ ...f, type: "file" })),
      ...lectureFilteredSummaries.map((s) => ({ ...s, type: "summary" })),
    ];

    const homeworkItems: any[] = [
      ...lectureFilteredFiles
        .filter((f) => f.title.includes(homeworkKeyword))
        .map((f) => ({ ...f, type: "file" })),
    ];

    const examItems: any[] = [
      ...lectureFilteredQuizzes.map((q) => ({ ...q, type: "quiz" })),
    ];

    return { explanationItems, homeworkItems, examItems };
  };

  const localizedSubjectName = useMemo(() => {
    if (locale === "en" && subjectDetails?.name_en) {
      return subjectDetails.name_en;
    }
    return subjectDetails?.name || normalizedSubjectName;
  }, [locale, subjectDetails, normalizedSubjectName]);

  useEffect(() => {
    if (localizedSubjectName) {
      document.title = `${localizedSubjectName} | Masar X`;
    }
  }, [localizedSubjectName]);

  const renderSubjectDashboard = () => {
    return (
      <SubjectDashboard
        isRTL={isRTL}
        isAdmin={isAdmin}
        normalizedSubjectName={localizedSubjectName}
        dashboardData={dashboardData}
        lectureIndex={lectureIndex}
        totalPossibleItems={totalPossibleItems}
        tSubjectPage={tSubjectPage}
        onBackToSubjects={() => router.push(`/${locale}/subjects`)}
        onEditSubject={() => setShowEditSubjectModal(true)}
        onAddLecture={() => setShowAddLectureForm(true)}
        onSelectLecture={(lectureKey) => {
          const next = new URLSearchParams(
            searchParams ? searchParams.toString() : "",
          );
          next.set("lecture", lectureKey);
          router.push(`?${next.toString()}`);
        }}
      />
    );
  };

  const renderLectureDetailView = () => {
    const { explanationItems, homeworkItems, examItems } =
      groupContentBySection();

    return (
      <LectureDetailView
        isRTL={isRTL}
        locale={locale}
        isAdmin={isAdmin}
        user={user}
        subjectName={localizedSubjectName}
        selectedLecture={selectedLecture}
        explanationItems={explanationItems}
        homeworkItems={homeworkItems}
        examItems={examItems}
        activeVideoUrl={activeVideoUrl}
        activeVideoTitle={activeVideoTitle}
        isTheatreMode={isTheatreMode}
        completedContent={completedContent}
        tSubjectPage={tSubjectPage}
        getYouTubeId={getYouTubeId}
        onBackToSubjects={() => router.push(`/${locale}/subjects`)}
        onBackToLectures={() => {
          const next = new URLSearchParams(
            searchParams ? searchParams.toString() : "",
          );
          next.delete("lecture");
          router.push(`?${next.toString()}`);
        }}
        onToggleTheatreMode={() => setIsTheatreMode((p) => !p)}
        onCloseVideo={() => {
          setActiveVideoUrl(null);
          setActiveVideoTitle(null);
          setIsTheatreMode(false);
        }}
        onToggleProgress={(contentId) => toggleProgress(contentId)}
        onViewContent={(item) => {
          if (item.type === "summary" && item.id) {
            trackSummaryClick(item.id, "view");
            router.push(`/summaries/${item.id}`);
            return;
          }
          if (item.type === "video" && item.url) {
            setActiveVideoUrl(item.url);
            setActiveVideoTitle(item.title);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          if (item.type === "file" && item.file_url) {
            window.open(item.file_url, "_blank");
            return;
          }
          if (item.type === "quiz" && item.id) {
            router.push(`/quiz-play?quizId=${item.id}`);
          }
        }}
        onAddVideo={() =>
          router.push(
            `/add-video?subject=${encodeURIComponent(normalizedSubjectName)}&lecture=${selectedLectureKey || ""}`,
          )
        }
        onAddFile={() =>
          router.push(
            `/add-file?subject=${encodeURIComponent(normalizedSubjectName)}&lecture=${selectedLectureKey || ""}`,
          )
        }
        onAddExam={() => {
          setShowAddExamForm(true);
          setExamFormData((p) => ({
            ...p,
            year: p.year || levels[0]?.name || "",
            department: p.department || "",
          }));
        }}
      />
    );
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!isLectureView ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderSubjectDashboard()}
          </motion.div>
        ) : (
          <motion.div
            key="lecture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderLectureDetailView()}
          </motion.div>
        )}
      </AnimatePresence>

      <EditSummaryModal
        summary={editingSummary}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveSummary}
      />

      <AddSubjectModal
        show={showEditSubjectModal}
        onClose={() => setShowEditSubjectModal(false)}
        onSave={handleUpdateSubject}
        editingSubject={subjectDetails}
      />

      <AddLectureModal
        isOpen={showAddLectureForm}
        onClose={() => {
          setShowAddLectureForm(false);
          setShowMergeWarning(false);
        }}
        tSubjectPage={tSubjectPage}
        tCommon={tCommon}
        lectureFormData={lectureFormData}
        setLectureFormData={setLectureFormData}
        getLectureInfoFromTitle={getLectureInfoFromTitle}
        isSavingLecture={isSavingLecture}
        onSaveLecture={handleSaveLecture}
        showMergeWarning={showMergeWarning}
        setShowMergeWarning={setShowMergeWarning}
      />

      <AddExamModal
        isOpen={showAddExamForm}
        onClose={() => setShowAddExamForm(false)}
        tSubjectPage={tSubjectPage}
        tCommon={tCommon}
        levels={levels}
        academicOptionsLoading={academicOptionsLoading}
        availableExamDepartments={availableExamDepartments as any}
        examFormData={examFormData}
        setExamFormData={setExamFormData}
        isSavingExam={isSavingExam}
        onSaveExam={handleSaveExam}
      />
    </div>
  );
}

export default function SubjectSummariesPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <SubjectPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Suspense fallback={<SubjectPageSkeleton />}>
        <SubjectSummariesContent />
      </Suspense>
    </div>
  );
}
