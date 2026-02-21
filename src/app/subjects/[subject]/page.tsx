"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Video,
  Plus,
  X,
  Clock,
  MapPin,
  Trophy,
  ArrowRight,
  GraduationCap,
  LayoutGrid,
  Layers,
  ArrowLeft,
  ChevronLeft,
  ClipboardList,
  CheckCircle,
  Monitor,
  Settings, // Added Settings icon
} from "lucide-react";
import { useSummaries } from "../../../hooks/useSummaries";
import { useAuth } from "../../../contexts/AuthContext";
import { useAnalytics } from "../../../hooks/useAnalytics";
import { EditSummaryModal } from "../../../components/EditSummaryModal";
import { AddSubjectModal } from "../../../components/AddSubjectModal"; // Added AddSubjectModal
import { supabase } from "../../../lib/supabase";
import { Quiz, Summary } from "../../../types/database";
import { useVideos } from "../../../hooks/useVideos";
import { useFiles } from "../../../hooks/useFiles";
import { Suspense } from "react";
import { toast } from "sonner";
import { useAcademicOptions } from "../../../hooks/useAcademicOptions";
import { queryCache, cacheKeys, cacheTTL } from "../../../lib/queryCache";

function SubjectSummariesContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectId = (params?.subject as string) || searchParams?.get("subject");
  const lectureFromQuery = searchParams?.get("lecture");
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const {
    levels,
    getDepartmentsForLevelName,
    loading: academicOptionsLoading,
  } = useAcademicOptions({ includeInactive: true });
  const summariesHook = useSummaries();
  const { trackSummaryClick } = useAnalytics();
  const [filteredSummaries, setFilteredSummaries] = useState<Summary[]>([]);
  const [savedLectures, setSavedLectures] = useState<
    Array<{
      id: string;
      subject: string;
      lecture_key: string;
      lecture_label: string;
      order_index: number;
      created_at: string;
      updated_at: string;
    }>
  >([]);
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLectureKey, setSelectedLectureKey] = useState<string | null>(
    null,
  );

  const [showAddLectureForm, setShowAddLectureForm] = useState(false);
  const [isSavingLecture, setIsSavingLecture] = useState(false);
  const [lectureFormData, setLectureFormData] = useState({
    title: "",
    label: "",
    key: "",
    orderIndex: "",
  });

  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);

  const [subjectQuizzes, setSubjectQuizzes] = useState<Quiz[]>([]);
  const [showAddExamForm, setShowAddExamForm] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [examFormData, setExamFormData] = useState({
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

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [isClient, setIsClient] = useState(false);

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
  useEffect(() => {
    setIsClient(true);
  }, []);

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
            "id, name, professor, description, schedule, location, level, semester, status, show_on_home, created_at",
          )
          .eq("name", normalizedSubjectName)
          .maybeSingle();

        if (data) {
          setSubjectDetails(data);
          queryCache.set(cacheKey, data, cacheTTL.subjects);
        }
      } catch (error) {
        console.error("Error fetching subject details:", error);
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
          setCompletedContent(new Set(data.map((d) => d.content_id)));
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
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
    professor: subjectDetails?.professor || "جاري التحميل...",
    description:
      subjectDetails?.description ||
      "وصف المادة سيظهر هنا بمجرد تحديثه من قبل المشرف.",
    progress: progressPercentage,
    schedule: subjectDetails?.schedule || "غير محدد",
    nextLecture: subjectDetails?.location || "غير محدد",
    totalLectures: `${completedContent.size}/${totalPossibleItems}`,
  };

  const isLectureView = useMemo(() => {
    return Boolean((lectureFromQuery || "").trim());
  }, [lectureFromQuery]);

  const toLatinDigits = (value: string) => {
    return (value || "")
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .trim();
  };

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

  const handleSaveLecture = async () => {
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    if (!isAdmin) {
      toast.error("غير مصرح");
      return;
    }

    const rawTitle = (lectureFormData.title || "").trim();
    if (!rawTitle) {
      toast.error("اكتب اسم المحاضرة");
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
        toast.error("فشل إنشاء كود المحاضرة تلقائياً");
        return;
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
      setLectureFormData({ title: "", label: "", key: "", orderIndex: "" });

      setSelectedLectureKey(key);
    } catch {
      toast.error("حدث خطأ أثناء إضافة المحاضرة.");
    } finally {
      setIsSavingLecture(false);
    }
  };

  const getLectureInfoFromTitle = (title: string) => {
    const t = (title || "").trim();
    if (!t) {
      return {
        key: "other",
        label: "غير مصنف",
        order: 999999,
      };
    }

    // 1. Check if the title matches a saved lecture exactly (label or key)
    const exactMatch = savedLectures.find(
      (l) =>
        l.lecture_label.trim().toLowerCase() === t.toLowerCase() ||
        l.lecture_key.trim().toLowerCase() === t.toLowerCase(),
    );
    if (exactMatch) {
      return {
        key: exactMatch.lecture_key,
        label: exactMatch.lecture_label,
        order: exactMatch.order_index,
      };
    }

    // 2. Check if the title starts with a saved lecture's label (e.g., "Partial fractions: Video")
    const prefixMatch = savedLectures.find((l) =>
      t.toLowerCase().startsWith(l.lecture_label.trim().toLowerCase()),
    );
    if (prefixMatch) {
      return {
        key: prefixMatch.lecture_key,
        label: prefixMatch.lecture_label,
        order: prefixMatch.order_index,
      };
    }

    const patterns: Array<{
      re: RegExp;
      labelPrefix: string;
    }> = [
      {
        re: /(محاضرة|محاضره)\s*([0-9٠-٩]+(?:\s*و\s*[0-9٠-٩]+)*)/i,
        labelPrefix: "محاضرة",
      },
      {
        re: /(lecture|lec|week)\s*([0-9٠-٩]+(?:\s*(?:&|and|-)\s*[0-9٠-٩]+)*)/i,
        labelPrefix: "Lecture",
      },
    ];

    for (const p of patterns) {
      const m = t.match(p.re);
      if (!m) continue;

      const rawNumPart = (m[2] || "").trim();
      const latin = toLatinDigits(rawNumPart);
      const firstNumberMatch = latin.match(/\d+/);
      const order = firstNumberMatch ? Number(firstNumberMatch[0]) : 999999;
      const normalizedKeyPart = latin
        .replace(/\s*و\s*/g, "-")
        .replace(/\s*(?:&|and)\s*/gi, "-")
        .replace(/\s+/g, "")
        .replace(/[^0-9-]/g, "");
      const key = normalizedKeyPart ? `lec-${normalizedKeyPart}` : "other";

      return {
        key,
        label: `${p.labelPrefix} ${rawNumPart}`,
        order: Number.isFinite(order) ? order : 999999,
      };
    }

    return {
      key: "other",
      label: "غير مصنف",
      order: 999999,
    };
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
      if (item.label === "غير مصنف" && label !== "غير مصنف") item.label = label;
    };

    savedLectures.forEach((l) => {
      const key = (l.lecture_key || "").trim() || "other";
      const label = (l.lecture_label || "").trim() || "غير مصنف";
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
        if (existing.label === "غير مصنف" && label !== "غير مصنف")
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
      const info = getLectureInfoFromTitle(q.title);
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

  const lectureFilteredSummaries = useMemo(() => {
    const key = selectedLectureKey || "other";
    return filteredSummaries.filter(
      (s) => getLectureInfoFromTitle(s.title).key === key,
    );
  }, [filteredSummaries, selectedLectureKey]);

  const lectureFilteredVideos = useMemo(() => {
    const key = selectedLectureKey || "other";
    return videos.filter((v) => getLectureInfoFromTitle(v.title).key === key);
  }, [selectedLectureKey, videos]);

  const lectureFilteredFiles = useMemo(() => {
    const key = selectedLectureKey || "other";
    return files.filter((f) => getLectureInfoFromTitle(f.title).key === key);
  }, [files, selectedLectureKey]);

  const lectureFilteredQuizzes = useMemo(() => {
    const key = selectedLectureKey || "other";
    return subjectQuizzes.filter(
      (q) => getLectureInfoFromTitle(q.title).key === key,
    );
  }, [selectedLectureKey, subjectQuizzes]);

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

  const handleSaveExam = async () => {
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
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
      toast.success("تم حفظ الامتحان بنجاح", {
        description: "تمت إضافة الامتحان وتحديث قائمة الامتحانات للمادة.",
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
      console.error("Error saving exam:", error);
      toast.error("حدث خطأ أثناء حفظ الامتحان", {
        description: error.message || "يرجى المحاولة مرة أخرى لاحقاً.",
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
      toast.success("تم تحديث البيانات بنجاح", {
        description: "تم تحديث بيانات المادة وحفظ التغييرات.",
      });
    } catch (error: any) {
      console.error("Error updating subject:", error);
      toast.error("فشل التحديث", {
        description: error.message || "حدث خطأ أثناء تحديث المادة.",
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
      console.error("Error updating progress:", error);
    }
  };

  const groupContentBySection = () => {
    const explanationItems: any[] = [
      ...lectureFilteredVideos.map((v) => ({ ...v, type: "video" })),
      ...lectureFilteredFiles
        .filter((f) => !f.title.includes("واجب"))
        .map((f) => ({ ...f, type: "file" })),
      ...lectureFilteredSummaries.map((s) => ({ ...s, type: "summary" })),
    ];

    const homeworkItems: any[] = [
      ...lectureFilteredFiles
        .filter((f) => f.title.includes("واجب"))
        .map((f) => ({ ...f, type: "file" })),
    ];

    const examItems: any[] = [
      ...lectureFilteredQuizzes.map((q) => ({ ...q, type: "quiz" })),
    ];

    return { explanationItems, homeworkItems, examItems };
  };

  const renderSubjectDashboard = () => {
    return (
      <div
        className="space-y-12 animate-in fade-in duration-700 pb-12 text-right"
        dir="rtl"
      >
        <div className="flex justify-start">
          <button
            onClick={() => router.push("/subjects")}
            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
          >
            <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
            العودة للمواد
          </button>
        </div>

        {/* Modern Glassmorphism Hero Section */}
        <div className="relative group overflow-hidden rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-500 hover:shadow-brand-blue/10">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-orange/5 opacity-50" />

          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-blue/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-orange/10 rounded-full blur-[100px] animate-pulse delay-700" />

          <div className="relative z-10 p-6 sm:p-10">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between">
              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap justify-start gap-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue-light text-xs font-black shadow-sm ring-1 ring-brand-blue/20">
                    <GraduationCap className="w-4 h-4" />
                    {dashboardData.professor}
                  </div>
                </div>

                <div className="space-y-3 text-right">
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                    <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue to-brand-blue/60">
                      مادة
                    </span>{" "}
                    {normalizedSubjectName}
                  </h1>
                  {isAdmin && (
                    <button
                      onClick={() => setShowEditSubjectModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-brand-blue hover:text-white transition-colors mt-2"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      تعديل بيانات المادة
                    </button>
                  )}
                  <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium">
                    {dashboardData.description}
                  </p>
                </div>

                <div className="flex flex-wrap justify-start gap-6 pt-4">
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      الجدول الزمني
                    </span>
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-5 py-2.5 rounded-2xl text-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                      <Clock className="w-6 h-6 text-brand-blue animate-pulse" />
                      {dashboardData.schedule}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      القاعة / المكان
                    </span>
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-5 py-2.5 rounded-2xl text-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                      <MapPin className="w-6 h-6 text-brand-orange" />
                      {dashboardData.nextLecture}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative group/progress">
                <div className="absolute inset-0 bg-brand-blue/20 blur-[40px] rounded-full scale-75 group-hover/progress:scale-100 transition-transform duration-700" />
                <div className="relative w-40 h-40 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full shadow-xl border-4 border-slate-50 dark:border-slate-800">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="transparent"
                      className="text-slate-100 dark:text-slate-800"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="url(#progressGradient)"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={
                        364.4 - (364.4 * dashboardData.progress) / 100
                      }
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient
                        id="progressGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#2dd4bf" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">
                      {dashboardData.progress}%
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      إنجازك
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative overflow-hidden group rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg hover:-translate-y-1 transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md">
                  <LayoutGrid className="w-6 h-6 text-brand-blue" />
                </div>
                <div className="text-left">
                  <span className="block text-3xl font-black">
                    {lectureIndex.length}
                  </span>
                  <span className="text-[10px] font-bold text-white/60">
                    محاضرة
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-black mb-1">استكشف المحتوى</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  جميع المحاضرات والملخصات منظمة بشكل يسهل عليك الوصول إليها
                </p>
              </div>
            </div>
          </div>

          <div className="relative group rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-md hover:-translate-y-1 transition-all duration-500 overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full items-center text-center">
              <div className="p-3 rounded-xl bg-green-500/10 text-green-500 mb-4 group-hover:bg-green-500 group-hover:text-white transition-all duration-500">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-2xl font-black text-slate-900 dark:text-white">
                  {dashboardData.totalLectures.split("/")[0]}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  إنجازاتك
                </span>
              </div>
            </div>
          </div>

          <div className="relative group rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-md hover:-translate-y-1 transition-all duration-500 overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-orange/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full items-center text-center">
              <div className="p-3 rounded-xl bg-brand-orange/10 text-brand-orange mb-4 group-hover:bg-brand-orange group-hover:text-white transition-all duration-500">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-2xl font-black text-slate-900 dark:text-white">
                  {totalPossibleItems}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  المحاضرات
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-brand-blue font-black text-[10px] uppercase tracking-[0.2em]">
                <div className="w-6 h-[1.5px] bg-brand-blue" />
                المحتوى التعليمي
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                قائمة المحاضرات
              </h2>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddLectureForm(true)}
                className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-blue text-white font-black hover:shadow-xl hover:shadow-brand-blue/30 transition-all active:scale-95 text-sm"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                إضافة محاضرة جديدة
              </button>
            )}
          </div>

          {lectureIndex.length === 0 ? (
            <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                لا توجد محاضرات بعد
              </h3>
              <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                عند إضافة محتوى للمادة سيظهر هنا تلقائيًا.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lectureIndex.map((lec, idx) => (
                <button
                  key={lec.key}
                  onClick={() => {
                    const next = new URLSearchParams(
                      searchParams ? searchParams.toString() : "",
                    );
                    next.set("lecture", lec.key);
                    router.push(`?${next.toString()}`);
                  }}
                  className="group relative flex flex-col p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500 hover:shadow-2xl hover:shadow-brand-blue/10 text-right"
                >
                  <div className="flex justify-between items-start mb-6 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand-blue transition-all duration-500 shadow-sm">
                      <span className="text-xl font-black text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">
                        {(idx + 1).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-slate-50 dark:border-slate-800 flex items-center justify-center group-hover:border-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all duration-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-2 leading-tight">
                      {lec.label}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {lec.counts.summaries > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[10px] font-black text-blue-600 dark:text-blue-400">
                          <FileText className="w-3 h-3" />
                          {lec.counts.summaries} ملخص
                        </div>
                      )}
                      {lec.counts.videos > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 dark:bg-red-900/20 text-[10px] font-black text-red-600 dark:text-red-400">
                          <Video className="w-3 h-3" />
                          {lec.counts.videos} فيديو
                        </div>
                      )}
                      {lec.counts.exams > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-green-50 dark:bg-green-900/20 text-[10px] font-black text-green-600 dark:text-green-400">
                          <Trophy className="w-3 h-3" />
                          {lec.counts.exams} اختبار
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      تم التحديث مؤخراً
                    </span>
                    <span className="group-hover:text-brand-blue transition-colors">
                      عرض التفاصيل
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLectureDetailView = () => {
    const { explanationItems, homeworkItems, examItems } =
      groupContentBySection();
    const lectureTitle = selectedLecture?.label || "المحاضرة";

    return (
      <div
        className={`space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 text-right ${
          isTheatreMode && activeVideoUrl ? "max-w-[100vw]" : ""
        }`}
        dir="rtl"
      >
        <div
          className={`flex flex-col gap-8 ${isTheatreMode && activeVideoUrl ? "mx-auto" : ""}`}
        >
          {!isTheatreMode && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/subjects")}
                className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-blue hover:text-brand-blue transition-all"
                title="العودة للمواد"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  const next = new URLSearchParams(
                    searchParams ? searchParams.toString() : "",
                  );
                  next.delete("lecture");
                  router.push(`?${next.toString()}`);
                }}
                className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all"
              >
                <LayoutGrid className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                العودة للمحاضرات
              </button>
            </div>
          )}

          {!isTheatreMode && (
            <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-white shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-blue/20 to-transparent" />
              <div className="relative z-10 space-y-4">
                <div className="inline-block px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-brand-blue-light font-black text-xs uppercase tracking-[0.2em] mb-2">
                  محتوى المحاضرة
                </div>
                <h1 className="text-5xl sm:text-6xl font-black leading-tight">
                  {lectureTitle}
                </h1>
                <div className="flex flex-wrap justify-start gap-4 mt-6">
                  <div className="px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold">
                    {explanationItems.length} شرح
                  </div>
                  <div className="px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold">
                    {homeworkItems.length} واجب
                  </div>
                  <div className="px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold">
                    {examItems.length} اختبار
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeVideoUrl && (
            <div
              className={`animate-in fade-in slide-in-from-top-4 duration-500 ${isTheatreMode ? "fixed inset-0 z-[100] bg-black flex flex-col h-[100dvh] w-screen overflow-hidden" : ""}`}
            >
              <div
                className={`bg-white dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col ${isTheatreMode ? "flex-1 border-none rounded-none" : "rounded-[2.5rem]"}`}
              >
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight line-clamp-1">
                        {activeVideoTitle}
                      </h3>
                      <p className="text-xs font-bold text-slate-400">
                        مشغل الفيديو
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsTheatreMode(!isTheatreMode)}
                      className={`p-2 rounded-xl transition-colors ${isTheatreMode ? "bg-brand-blue text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"}`}
                      title={
                        isTheatreMode ? "الخروج من وضع المسرح" : "وضع المسرح"
                      }
                    >
                      <Monitor className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveVideoUrl(null);
                        setActiveVideoTitle(null);
                        setIsTheatreMode(false);
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div
                  className={`relative bg-black ${isTheatreMode ? "flex-1" : "aspect-video"}`}
                >
                  {getYouTubeId(activeVideoUrl) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYouTubeId(activeVideoUrl)}?autoplay=1`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <video
                      src={activeVideoUrl}
                      controls
                      autoPlay
                      className="absolute inset-0 w-full h-full"
                    ></video>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <Video className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                  الشرح والدروس
                </h2>
                {isAdmin && (
                  <div className="flex gap-2 mr-auto">
                    <button
                      onClick={() =>
                        router.push(
                          `/add-video?subject=${encodeURIComponent(normalizedSubjectName)}&lecture=${selectedLectureKey || ""}`,
                        )
                      }
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue font-bold text-xs hover:bg-brand-blue hover:text-white transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      فيديو
                    </button>
                    <button
                      onClick={() =>
                        router.push(
                          `/add-file?subject=${encodeURIComponent(normalizedSubjectName)}&lecture=${selectedLectureKey || ""}`,
                        )
                      }
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange/10 text-brand-orange font-bold text-xs hover:bg-brand-orange hover:text-white transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      ملف
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {explanationItems.length === 0 ? (
                  <div className="p-12 text-center rounded-[2.5rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="text-slate-400 font-black italic">
                      لا يوجد محتوى شرح حالياً
                    </div>
                  </div>
                ) : (
                  explanationItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="group flex flex-col sm:flex-row items-center gap-6 p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-brand-blue/5"
                    >
                      <div
                        className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${
                          item.type === "video"
                            ? "bg-red-50 text-red-500"
                            : "bg-brand-blue/5 text-brand-blue"
                        }`}
                      >
                        {item.type === "video" ? (
                          <Video className="w-8 h-8" />
                        ) : (
                          <FileText className="w-8 h-8" />
                        )}
                      </div>
                      <div className="flex-1 text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-black text-slate-900 dark:text-white">
                            {item.title}
                          </h4>
                          {item.type === "video" && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {item.type === "video"
                              ? "فيديو تدريبي"
                              : item.type === "summary"
                                ? "ملخص دراسي"
                                : "ملف دراسي"}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <span className="text-xs font-bold text-slate-400">
                            {new Date(
                              item.created_at || Date.now(),
                            ).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                      {user && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgress(
                                item.id || item.url || item.file_url,
                              );
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              completedContent.has(
                                item.id || item.url || item.file_url,
                              )
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 hover:bg-green-50 hover:text-green-500"
                            }`}
                            title={
                              completedContent.has(
                                item.id || item.url || item.file_url,
                              )
                                ? "إلغاء التحديد"
                                : "تحديد كمكتمل"
                            }
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              if (item.type === "summary") {
                                trackSummaryClick(item.id, "view");
                                router.push(`/summaries/${item.id}`);
                              } else if (item.type === "video") {
                                setActiveVideoUrl(item.url);
                                setActiveVideoTitle(item.title);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              } else if (item.file_url) {
                                window.open(item.file_url, "_blank");
                              }
                            }}
                            className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-brand-blue transition-all"
                          >
                            عرض المحتوى
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {homeworkItems.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                    التكاليف والواجبات
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {homeworkItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-8 rounded-[2.5rem] bg-gradient-to-br from-brand-orange to-brand-orange-light text-white shadow-lg group hover:scale-[1.02] transition-transform duration-500 text-right"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <FileText className="w-10 h-10 opacity-40" />
                        {user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgress(
                                item.id || item.url || item.file_url,
                              );
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              completedContent.has(
                                item.id || item.url || item.file_url,
                              )
                                ? "bg-white/30 text-white"
                                : "bg-white/10 text-white/60 hover:bg-white/20"
                            }`}
                            title={
                              completedContent.has(
                                item.id || item.url || item.file_url,
                              )
                                ? "إلغاء التحديد"
                                : "تحديد كمكتمل"
                            }
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-xl font-black mb-4">{item.title}</h4>
                      <button
                        onClick={() => {
                          if (item.file_url) {
                            window.open(item.file_url, "_blank");
                          }
                        }}
                        className="w-full py-3 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 font-black text-sm hover:bg-white/30 transition-all"
                      >
                        تحميل الواجب
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                معلومات المحاضرة
              </h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">
                    تاريخ الإضافة
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    2026/02/18
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">
                    عدد المصادر
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {explanationItems.length + homeworkItems.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">
                    الاختبارات
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {examItems.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-brand-blue" />
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  الاختبارات
                </h3>
              </div>

              <div className="space-y-4">
                {examItems.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 font-bold italic">
                    لا يوجد اختبارات
                  </div>
                ) : (
                  examItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="group p-6 rounded-[2rem] bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 hover:border-brand-blue transition-all duration-500"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-black text-slate-900 dark:text-white leading-tight">
                          {item.title}
                        </h4>
                        {user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgress(item.id);
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              completedContent.has(item.id)
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 hover:bg-green-50 hover:text-green-500"
                            }`}
                            title={
                              completedContent.has(item.id)
                                ? "إلغاء التحديد"
                                : "تحديد كمكتمل"
                            }
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/quiz-play?quizId=${item.id}`)
                        }
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-blue text-white font-black text-sm group-hover:shadow-lg group-hover:shadow-brand-blue/30 transition-all"
                      >
                        ابدأ التحدي
                        <ArrowLeft className="w-4 h-4 mr-2" />
                      </button>
                    </div>
                  ))
                )}

                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowAddExamForm(true);
                      setExamFormData((p) => ({
                        ...p,
                        year: p.year || levels[0]?.name || "",
                        department: p.department || "",
                      }));
                    }}
                    className="w-full flex items-center justify-center gap-2 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-brand-blue hover:text-brand-blue transition-all font-black"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة اختبار
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isLectureView ? renderSubjectDashboard() : renderLectureDetailView()}
      </div>
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

      {showAddLectureForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowAddLectureForm(false)}
              className="absolute top-6 left-6 text-slate-400 hover:text-brand-blue transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
              إضافة محاضرة جديدة
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  عنوان المحاضرة
                </label>
                <input
                  type="text"
                  value={lectureFormData.title}
                  onChange={(e) =>
                    setLectureFormData((p) => ({
                      ...p,
                      title: e.target.value,
                      ...(p.key.trim()
                        ? {}
                        : { key: getLectureInfoFromTitle(e.target.value).key }),
                    }))
                  }
                  placeholder="مثال: محاضرة 1"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  اسم المحاضرة (للعرض)
                </label>
                <input
                  type="text"
                  value={lectureFormData.label}
                  onChange={(e) =>
                    setLectureFormData((p) => ({ ...p, label: e.target.value }))
                  }
                  placeholder={
                    getLectureInfoFromTitle(lectureFormData.title).label
                  }
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  الترتيب (اختياري)
                </label>
                <input
                  type="number"
                  value={lectureFormData.orderIndex}
                  onChange={(e) =>
                    setLectureFormData((p) => ({
                      ...p,
                      orderIndex: e.target.value,
                    }))
                  }
                  placeholder="تلقائي"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                />
              </div>
              <button
                onClick={handleSaveLecture}
                disabled={isSavingLecture || !lectureFormData.title.trim()}
                className="w-full py-4 rounded-2xl bg-brand-blue text-white font-black text-lg hover:shadow-xl hover:shadow-brand-blue/30 disabled:opacity-50 transition-all mt-4"
              >
                {isSavingLecture ? "جاري الحفظ..." : "حفظ المحاضرة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddExamForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                إضافة امتحان جديد
              </h3>
              <button
                onClick={() => setShowAddExamForm(false)}
                className="text-slate-400 hover:text-brand-blue transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    عنوان الامتحان
                  </label>
                  <input
                    value={examFormData.title}
                    onChange={(e) =>
                      setExamFormData((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    المدة (بالدقائق)
                  </label>
                  <input
                    type="number"
                    value={examFormData.durationMinutes}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        durationMinutes: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    القسم
                  </label>
                  <select
                    value={examFormData.department}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        department: e.target.value,
                      }))
                    }
                    disabled={
                      academicOptionsLoading ||
                      !examFormData.year ||
                      availableExamDepartments.length === 0
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  >
                    <option value="" disabled>
                      اختر القسم...
                    </option>
                    {availableExamDepartments.map((dep) => (
                      <option
                        key={dep.id}
                        value={dep.name}
                        disabled={!dep.is_active}
                      >
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">
                    السنة
                  </label>
                  <select
                    value={examFormData.year}
                    onChange={(e) =>
                      setExamFormData((p) => ({
                        ...p,
                        year: e.target.value,
                        department: "",
                      }))
                    }
                    disabled={academicOptionsLoading || levels.length === 0}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                  >
                    <option value="" disabled>
                      اختر المستوى...
                    </option>
                    {levels.map((lvl) => (
                      <option
                        key={lvl.id}
                        value={lvl.name}
                        disabled={!lvl.is_active}
                      >
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t-2 border-slate-50 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">
                    الأسئلة
                  </h4>
                  <button
                    onClick={() =>
                      setExamFormData((p) => ({
                        ...p,
                        questions: [
                          ...p.questions,
                          {
                            question: "",
                            options: ["", "", "", ""],
                            correctAnswer: 0,
                            explanation: "",
                          },
                        ],
                      }))
                    }
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold hover:bg-brand-blue hover:text-white transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> إضافة سؤال
                  </button>
                </div>

                <div className="space-y-8">
                  {examFormData.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-brand-blue/20 transition-all"
                    >
                      <div className="flex justify-between mb-4">
                        <span className="text-sm font-black text-brand-blue uppercase tracking-widest">
                          سؤال {idx + 1}
                        </span>
                        {examFormData.questions.length > 1 && (
                          <button
                            onClick={() =>
                              setExamFormData((p) => ({
                                ...p,
                                questions: p.questions.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="text-red-500 font-bold text-xs"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                      <input
                        value={q.question}
                        onChange={(e) =>
                          setExamFormData((p) => ({
                            ...p,
                            questions: p.questions.map((it, i) =>
                              i === idx
                                ? { ...it, question: e.target.value }
                                : it,
                            ),
                          }))
                        }
                        placeholder="نص السؤال (يدعم LaTeX)"
                        className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold mb-4"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {q.options.map((opt, optIdx) => (
                          <input
                            key={optIdx}
                            value={opt}
                            onChange={(e) =>
                              setExamFormData((p) => ({
                                ...p,
                                questions: p.questions.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        options: it.options.map((o, oi) =>
                                          oi === optIdx ? e.target.value : o,
                                        ),
                                      }
                                    : it,
                                ),
                              }))
                            }
                            placeholder={`اختيار ${optIdx + 1}`}
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-transparent focus:border-brand-blue outline-none transition-all font-bold"
                          />
                        ))}
                      </div>
                      <div className="mt-4 flex gap-4">
                        <select
                          value={q.correctAnswer}
                          onChange={(e) =>
                            setExamFormData((p) => ({
                              ...p,
                              questions: p.questions.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      correctAnswer: Number(e.target.value),
                                    }
                                  : it,
                              ),
                            }))
                          }
                          className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 font-bold outline-none"
                        >
                          <option value={0}>الاختيار الأول صحيح</option>
                          <option value={1}>الاختيار الثاني صحيح</option>
                          <option value={2}>الاختيار الثالث صحيح</option>
                          <option value={3}>الاختيار الرابع صحيح</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveExam}
                disabled={
                  isSavingExam ||
                  !examFormData.title.trim() ||
                  !examFormData.year
                }
                className="w-full py-5 rounded-3xl bg-brand-blue text-white font-black text-xl hover:shadow-2xl hover:shadow-brand-blue/40 disabled:opacity-50 transition-all"
              >
                {isSavingExam ? "جاري الحفظ..." : "حفظ الامتحان"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubjectSummariesPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue text-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Suspense
        fallback={
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue text-brand-blue"></div>
          </div>
        }
      >
        <SubjectSummariesContent />
      </Suspense>
    </div>
  );
}
