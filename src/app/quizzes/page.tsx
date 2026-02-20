"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Edit,
  Trash2,
  Play,
  BookOpen,
  Download,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/hooks/useSubjects";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { aiAssistant } from "@/lib/ai-assistant";
import type { Quiz, Summary } from "@/types/database";
import { LatexRenderer } from "@/components/LatexRenderer";

interface QuizWithMeta {
  quiz: Quiz;
  meta: {
    subject: string;
    department: string;
    year: string;
    semester: string;
    descriptionText: string;
  };
}

// Use dynamic import with ssr: false for the main component to prevent hydration mismatches
const QuizDashboard = dynamic(() => Promise.resolve(QuizDashboardInternal), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

export default function QuizDashboardPage() {
  return <QuizDashboard />;
}

function QuizDashboardInternal() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { subjects: allSubjects, loading: subjectsLoading } = useSubjects();
  const { levels: academicLevels, getDepartmentsForLevelName } =
    useAcademicOptions();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importMode, setImportMode] = useState<"json" | "text">("json");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    subject: "",
    department: "",
    year: "",
    semester: "",
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    durationMinutes: "",
    department: "",
    year: "",
    semester: "",
    subject: "",
    summaryId: "",
    questions: [
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
        type: "multiple-choice" as "multiple-choice" | "true-false",
        imageUrl: "",
      },
    ],
  });

  const selectedFormLevelNumber = useMemo(() => {
    if (!formData.year) return null;
    const found = academicLevels.find((l) => l.name === formData.year);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [academicLevels, formData.year]);

  const selectedFormSemesterNumber = useMemo(() => {
    if (!formData.year) return undefined;
    if (!formData.semester) return null;
    const n = Number(formData.semester);
    return Number.isFinite(n) ? n : null;
  }, [formData.semester, formData.year]);

  const { subjects: filteredSubjectsForForm } = useSubjects({
    level: formData.year ? selectedFormLevelNumber : undefined,
    semester: selectedFormSemesterNumber,
  });

  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from("quizzes").select("*");
      if (!isAdmin) {
        query = query.eq("status", "approved");
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      setQuizzes(data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadMyAttempts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, total_questions")
        .eq("user_id", user.id);

      if (error) throw error;

      const attemptsMap: Record<
        string,
        { quiz_id: string; score: number; total_questions: number }
      > = {};

      (data || []).forEach((attempt) => {
        const quizId =
          typeof attempt.quiz_id === "string" ? attempt.quiz_id : "";
        const score = typeof attempt.score === "number" ? attempt.score : 0;
        const totalQuestions =
          typeof attempt.total_questions === "number"
            ? attempt.total_questions
            : 0;

        if (!quizId) return;

        if (!attemptsMap[quizId] || score > attemptsMap[quizId].score) {
          attemptsMap[quizId] = {
            quiz_id: quizId,
            score,
            total_questions: totalQuestions,
          };
        }
      });
      // setMyAttempts(attemptsMap);
    } catch {
      // ignore
    }
  }, [user]);

  const fetchSummaries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("subject", formData.subject)
        .eq("department", formData.department)
        .eq("status", "approved");

      if (error) throw error;
      setSummaries(data || []);
    } catch {
      // ignore
    }
  }, [formData.subject, formData.department]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    if (!user) return;
    loadMyAttempts();
  }, [user, loadMyAttempts]);

  useEffect(() => {
    if (formData.subject && formData.department) {
      fetchSummaries();
    } else {
      setSummaries([]);
    }
  }, [formData.subject, formData.department, fetchSummaries]);

  const quizzesWithMeta = useMemo(() => {
    return quizzes.map((quiz: Quiz) => {
      const quizRecord = quiz as unknown as Record<string, unknown>;
      let subject =
        typeof quizRecord.subject === "string" ? quizRecord.subject : "";
      let department =
        typeof quizRecord.department === "string" ? quizRecord.department : "";
      let year = typeof quizRecord.year === "string" ? quizRecord.year : "";
      let semester = "";
      let parsedDescription = "";

      try {
        const parsed = JSON.parse(quiz.description || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          const obj = parsed as Record<string, unknown>;
          if (!subject && typeof obj.subject === "string")
            subject = obj.subject;
          if (!department && typeof obj.department === "string")
            department = obj.department;
          if (!year && typeof obj.year === "string") year = obj.year;
          if (semester === "") {
            const sem = obj.semester;
            if (typeof sem === "number" || typeof sem === "string") {
              const n = Number(sem);
              if (Number.isFinite(n) && (n === 1 || n === 2)) {
                semester = String(n);
              }
            }
          }
          if (typeof obj.description === "string")
            parsedDescription = obj.description;
        }
      } catch {
        // ignore
      }

      return {
        quiz,
        meta: {
          subject: (subject || "").toString(),
          department: (department || "").toString(),
          year: (year || "").toString(),
          semester: (semester || "").toString(),
          descriptionText: (parsedDescription || "").toString(),
        },
      };
    });
  }, [quizzes]);

  const selectedLevelNumber = useMemo(() => {
    if (!filters.year) return null;
    const found = academicLevels.find((l) => l.name === filters.year);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [academicLevels, filters.year]);

  const selectedSemesterNumber = useMemo(() => {
    if (!filters.year) return undefined;
    if (!filters.semester) return null;
    const n = Number(filters.semester);
    return Number.isFinite(n) ? n : null;
  }, [filters.semester, filters.year]);

  const { subjects: filteredSubjectsForFilters } = useSubjects({
    level: filters.year ? selectedLevelNumber : undefined,
    semester: selectedSemesterNumber,
  });

  const filterOptions = useMemo(() => {
    const subjects = new Set<string>();
    const departments = new Set<string>();
    const years = new Set<string>();
    const semesters = new Set<string>();

    quizzesWithMeta.forEach(({ meta }: QuizWithMeta) => {
      if (meta.subject) subjects.add(meta.subject);
      if (meta.department) departments.add(meta.department);
      if (meta.year) years.add(meta.year);
      if (meta.semester) semesters.add(meta.semester);
    });

    const subjectList = subjectsLoading
      ? Array.from(subjects).sort((a, b) => a.localeCompare(b, "ar"))
      : (filters.year ? filteredSubjectsForFilters : allSubjects)
          .map((s) => s.name)
          .sort((a, b) => a.localeCompare(b, "ar"));

    const derivedYears = Array.from(years)
      .map((v) => (v || "").trim())
      .filter(Boolean)
      .filter((v) => !/^\d+$/.test(v))
      .sort((a, b) => a.localeCompare(b, "ar"));

    const academicLevelNames = academicLevels
      .map((l) => (l.name || "").trim())
      .filter(Boolean);

    const yearOptions =
      academicLevelNames.length > 0 ? academicLevelNames : derivedYears;
    const departmentsForSelectedYear = filters.year
      ? getDepartmentsForLevelName(filters.year).map((d) => d.name)
      : [];

    const deptOptions = filters.year ? departmentsForSelectedYear : [];

    const semesterOptions = ["1", "2"].filter((v) => {
      if (!filters.year) return true;
      if (semesters.size === 0) return true;
      return semesters.has(v);
    });

    return {
      subjects: subjectList,
      departments: filters.year ? deptOptions : [], // Return empty departments list when filters.year is empty
      years: yearOptions,
      semesters: semesterOptions,
    };
  }, [
    quizzesWithMeta,
    allSubjects,
    filteredSubjectsForFilters,
    subjectsLoading,
    academicLevels,
    filters.semester,
    filters.year,
    getDepartmentsForLevelName,
  ]);

  const filteredQuizzes = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    const allowedSubjects = user
      ? null
      : new Set(
          allSubjects.map((sub) => (sub.name || "").trim()).filter(Boolean),
        );

    return quizzesWithMeta
      .filter(({ quiz, meta }: QuizWithMeta) => {
        if (
          allowedSubjects &&
          meta.subject &&
          !allowedSubjects.has(meta.subject.trim())
        )
          return false;

        if (filters.subject && meta.subject !== filters.subject) return false;
        if (filters.department && meta.department !== filters.department)
          return false;
        if (filters.year && meta.year !== filters.year) return false;
        if (filters.semester && meta.semester !== filters.semester)
          return false;

        if (!s) return true;

        const title = (quiz.title || "").toLowerCase();
        const rawDesc = (quiz.description || "").toLowerCase();
        const parsedDesc = (meta.descriptionText || "").toLowerCase();

        return (
          title.includes(s) || rawDesc.includes(s) || parsedDesc.includes(s)
        );
      })
      .map(({ quiz }: QuizWithMeta) => quiz);
  }, [
    allSubjects,
    filters.department,
    filters.search,
    filters.semester,
    filters.subject,
    filters.year,
    quizzesWithMeta,
    user,
  ]);

  const handleSaveQuiz = async () => {
    try {
      if (!user) return;

      const durationMinutesNum = formData.durationMinutes
        ? Number(formData.durationMinutes)
        : null;
      const durationSeconds =
        typeof durationMinutesNum === "number" &&
        !Number.isNaN(durationMinutesNum) &&
        durationMinutesNum > 0
          ? Math.round(durationMinutesNum * 60)
          : null;

      const quizData = {
        title: formData.title,
        summary_id: formData.summaryId || null,
        questions: formData.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          type: q.type,
          imageUrl: q.imageUrl,
        })),
      };

      const descriptionData = {
        description: formData.description,
        department: formData.department,
        year: formData.year,
        subject: formData.subject,
      };
      const fullDescription = JSON.stringify(descriptionData);

      if (editingQuiz) {
        const { error: quizError } = await supabase
          .from("quizzes")
          .update({
            title: formData.title,
            description: fullDescription,
            summary_id: formData.summaryId || null,
            duration_seconds: durationSeconds,
          })
          .eq("id", editingQuiz.id);

        if (quizError) throw quizError;

        const { error: deleteError } = await supabase
          .from("quiz_questions")
          .delete()
          .eq("quiz_id", editingQuiz.id);

        if (deleteError) throw deleteError;

        const questionsToInsert = formData.questions.map((q, index) => ({
          quiz_id: editingQuiz.id,
          question: q.question,
          options: q.type === "true-false" ? ["صح", "خطأ"] : q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
          image_url: q.imageUrl,
          order_index: index,
        }));

        const { error: questionsError } = await supabase
          .from("quiz_questions")
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      } else {
        const { data: quiz, error: quizError } = await supabase
          .from("quizzes")
          .insert({
            title: quizData.title,
            description: fullDescription,
            summary_id: quizData.summary_id,
            user_id: user.id,
            source_type: "manual",
            duration_seconds: durationSeconds,
          })
          .select()
          .single();

        if (quizError) throw quizError;

        const questionsToInsert = quizData.questions.map((q, index) => ({
          quiz_id: quiz.id,
          question: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
          image_url: q.imageUrl,
          order_index: index,
        }));

        const { error: questionsError } = await supabase
          .from("quiz_questions")
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      await loadQuizzes();
      alert("تم حفظ الامتحان بنجاح");
      setShowCreateForm(false);
      setEditingQuiz(null);
      setFormData({
        title: "",
        description: "",
        durationMinutes: "",
        department: "",
        year: "",
        semester: "",
        subject: "",
        summaryId: "",
        questions: [
          {
            question: "",
            options: ["", "", "", ""],
            correctAnswer: 0,
            explanation: "",
            type: "multiple-choice",
            imageUrl: "",
          },
        ],
      });
    } catch {
      alert("حدث خطأ أثناء حفظ الامتحان.");
    }
  };

  const handleEditQuiz = async (quiz: Quiz) => {
    try {
      const { data: questions, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("order_index");

      if (error) throw error;

      let parsedDescription = quiz.description || "";
      let department = "";
      let year = "";
      let semester = "";
      let subject = "";

      try {
        const parsed = JSON.parse(quiz.description || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          department = parsed.department || "";
          year = parsed.year || "";
          semester = parsed.semester ? String(parsed.semester) : "";
          subject = parsed.subject || "";
          parsedDescription = parsed.description || "";
        }
      } catch {
        // ignore
      }

      setEditingQuiz(quiz);
      const quizRecord = quiz as unknown as Record<string, unknown>;
      const durationSecondsRaw = quizRecord.duration_seconds;
      const durationMinutes =
        typeof durationSecondsRaw === "number"
          ? String(Math.round(durationSecondsRaw / 60))
          : "";

      setFormData({
        title: quiz.title,
        description: parsedDescription,
        durationMinutes,
        department,
        year,
        semester,
        subject,
        summaryId: quiz.summary_id || "",
        questions: (questions || []).map((q) => {
          const isTrueFalse =
            Array.isArray(q.options) &&
            q.options.length === 2 &&
            q.options.includes("صح") &&
            q.options.includes("خطأ");
          return {
            question: q.question,
            options: q.options,
            correctAnswer: q.correct_answer,
            explanation: q.explanation || "",
            type: isTrueFalse ? "true-false" : "multiple-choice",
            imageUrl: q.image_url || "",
          };
        }),
      });
      setShowCreateForm(true);
    } catch {
      // ignore
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الاختبار؟")) return;

    try {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      if (error) throw error;
      await loadQuizzes();
    } catch {
      // ignore
    }
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          question: "",
          options: ["", "", "", ""],
          correctAnswer: 0,
          explanation: "",
          type: "multiple-choice",
          imageUrl: "",
        },
      ],
    });
  };

  const deleteQuestion = (index: number) => {
    if (formData.questions.length <= 1) {
      alert("يجب أن يحتوي الامتحان على سؤال واحد على الأقل");
      return;
    }
    const updatedQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const updateQuestion = (index: number, field: string, value: unknown) => {
    const updatedQuestions = [...formData.questions];

    if (field === "type") {
      if (value === "true-false") {
        updatedQuestions[index] = {
          ...updatedQuestions[index],
          type: "true-false",
          options: ["صح", "خطأ"],
          correctAnswer: 0,
        };
      } else {
        updatedQuestions[index] = {
          ...updatedQuestions[index],
          type: "multiple-choice",
          options: ["", "", "", ""],
          correctAnswer: 0,
        };
      }
    } else {
      updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    }

    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const result = await uploadToCloudinary(file, {
        folder: "quiz-images",
        resourceType: "image",
      });

      updateQuestion(index, "imageUrl", result.url);
    } catch {
      alert("حدث خطأ أثناء رفع الصورة");
    }
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleImport = async (mode: "json" | "text") => {
    if (mode === "json") {
      try {
        const questions = JSON.parse(importJson);
        if (!Array.isArray(questions)) {
          alert("تنسيق JSON غير صحيح. يجب أن يكون مصفوفة من الأسئلة.");
          return;
        }

        const isValid = questions.every(
          (q) =>
            q.question &&
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            typeof q.correctAnswer === "number" &&
            q.correctAnswer >= 0 &&
            q.correctAnswer < q.options.length,
        );

        if (!isValid) {
          alert(
            "تنسيق الأسئلة غير صحيح. تأكد من وجود السؤال، خيارين على الأقل، والإجابة الصحيحة ضمن الخيارات المتاحة.",
          );
          return;
        }

        setFormData((prevFormData) => ({
          ...prevFormData,
          questions: [
            ...prevFormData.questions,
            ...questions.map((q) => {
              const qObj =
                typeof q === "object" && q !== null
                  ? (q as Record<string, unknown>)
                  : ({} as Record<string, unknown>);
              const questionText =
                typeof qObj.question === "string" ? qObj.question : "";
              const options = Array.isArray(qObj.options)
                ? (qObj.options.filter(
                    (o) => typeof o === "string",
                  ) as string[])
                : [];
              const correctAnswer =
                typeof qObj.correctAnswer === "number" ? qObj.correctAnswer : 0;
              const explanation =
                typeof qObj.explanation === "string" ? qObj.explanation : "";

              const typeRaw = typeof qObj.type === "string" ? qObj.type : "";
              const type: "multiple-choice" | "true-false" =
                typeRaw === "true-false" ? "true-false" : "multiple-choice";

              const imageUrl =
                typeof qObj.imageUrl === "string" ? qObj.imageUrl : "";
              return {
                question: questionText,
                options,
                correctAnswer,
                explanation,
                type,
                imageUrl,
              };
            }),
          ],
        }));
        setShowImportModal(false);
        setImportJson("");
        setImportMode("json");
        alert("تم إنشاء الأسئلة بنجاح!");
      } catch {
        alert("حدث خطأ أثناء تحليل JSON. تأكد من صحة التنسيق.");
      }
    } else if (mode === "text") {
      if (!importJson.trim()) return;

      try {
        setIsGenerating(true);
        const result = await aiAssistant.generateQuiz(importJson);

        if (result && Array.isArray(result.questions)) {
          setFormData({
            ...formData,
            title: result.title || formData.title,
            questions: result.questions.map((q) => {
              const qObj =
                typeof q === "object" && q !== null
                  ? (q as Record<string, unknown>)
                  : ({} as Record<string, unknown>);
              return {
                ...qObj,
                imageUrl:
                  typeof qObj.imageUrl === "string" ? qObj.imageUrl : "",
              };
            }) as unknown as typeof formData.questions,
          });
          setShowImportModal(false);
          setImportJson("");
          setImportMode("json");
          alert("تم إنشاء الأسئلة بنجاح باستخدام الذكاء الاصطناعي!");
        } else {
          throw new Error("Invalid format received from AI");
        }
      } catch {
        alert("حدث خطأ أثناء إنشاء الأسئلة. حاول مرة أخرى.");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isAdmin ? "إدارة الامتحانات" : "الامتحانات"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {isAdmin
              ? "إنشاء وإدارة امتحانات المواد"
              : "تصفح الامتحانات المتاحة حسب المستوى والترم"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            امتحان جديد
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={filters.search}
            onChange={(e) =>
              setFilters((p) => ({ ...p, search: e.target.value }))
            }
            placeholder="ابحث في العنوان أو الوصف..."
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white"
          />

          <select
            value={filters.year}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                year: e.target.value,
                semester: "",
                department: "",
                subject: "",
              }))
            }
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white"
          >
            <option value="">كل المستويات</option>
            {filterOptions.years.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filters.semester}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                semester: e.target.value,
                department: "",
                subject: "",
              }))
            }
            disabled={!filters.year}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value="">كل الترمات</option>
            {filterOptions.semesters.map((v) => (
              <option key={v} value={v}>
                ترم {v}
              </option>
            ))}
          </select>

          <select
            value={filters.department}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                department: e.target.value,
                subject: "",
              }))
            }
            disabled={
              !filters.year ||
              !filters.semester ||
              filterOptions.departments.length === 0
            }
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value="">كل الأقسام</option>
            {filterOptions.departments.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filters.subject}
            onChange={(e) =>
              setFilters((p) => ({ ...p, subject: e.target.value }))
            }
            disabled={!filters.year || !filters.semester || !filters.department}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 dark:text-white disabled:opacity-60"
          >
            <option value="">كل المواد</option>
            {filterOptions.subjects.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {(filters.search ||
          filters.subject ||
          filters.department ||
          filters.year ||
          filters.semester) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() =>
                setFilters({
                  search: "",
                  subject: "",
                  department: "",
                  year: "",
                  semester: "",
                })
              }
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              <X className="w-4 h-4" />
              مسح الفلاتر
            </button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8">
          <button
            onClick={() => router.push("/quiz-attempts")}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors disabled:opacity-60"
          >
            <div className="font-bold text-gray-900 dark:text-white">
              امتحاناتي السابقة
            </div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              عرض التفاصيل
            </div>
          </button>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {importMode === "json"
                ? "استيراد أسئلة من NotebookLM"
                : "إنشاء أسئلة بالذكاء الاصطناعي"}
            </h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setImportMode("json")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  importMode === "json"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                استيراد JSON
              </button>
              <button
                onClick={() => setImportMode("text")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  importMode === "text"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>توليد من النص</span>
                </div>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {importMode === "json"
                ? "الصق كود JSON المستخرج من NotebookLM هنا. ستتم إضافة الأسئلة الجديدة إلى الأسئلة الحالية."
                : "الصق نص المحاضرة أو الملخص هنا، وسيقوم الذكاء الاصطناعي بإنشاء أسئلة عليه."}
            </p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full h-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
              placeholder={
                importMode === "json"
                  ? '[{"question": "...", "options": ["..."], "correctAnswer": 0, "explanation": "..."}]'
                  : "الصق النص هنا..."
              }
            />
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
              {importMode === "json" ? (
                <button
                  onClick={() => handleImport("json")}
                  disabled={!importJson.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  استيراد
                </button>
              ) : (
                <button
                  onClick={() => handleImport("text")}
                  disabled={!importJson.trim() || isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>جاري التوليد...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>توليد الأسئلة</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingQuiz ? "تحرير الامتحان" : "إنشاء امتحان جديد"}
            </h2>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              استيراد
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                عنوان الامتحان
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="مثال: امتحان في مادة الرياضيات"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                مدة الامتحان بالدقائق (اختياري)
              </label>
              <input
                type="number"
                min={1}
                value={formData.durationMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, durationMinutes: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="مثال: 30"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المستوى الدراسي <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      year: e.target.value,
                      department: "",
                      semester: "",
                      subject: "",
                      summaryId: "",
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">اختر المستوي</option>
                  {academicLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.name}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الترم <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      semester: e.target.value,
                      department: "",
                      subject: "",
                      summaryId: "",
                    })
                  }
                  disabled={!formData.year}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                >
                  <option value="">اختر الترم</option>
                  <option value="1">ترم 1</option>
                  <option value="2">ترم 2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  التخصص <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      department: e.target.value,
                      subject: "",
                      summaryId: "",
                    })
                  }
                  disabled={
                    !formData.year ||
                    !formData.semester ||
                    getDepartmentsForLevelName(formData.year).length === 0
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                >
                  <option value="">اختر التخصص</option>
                  {getDepartmentsForLevelName(formData.year).map((dep) => (
                    <option key={dep.id} value={dep.name}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم المادة <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      subject: e.target.value,
                      summaryId: "",
                    })
                  }
                  disabled={
                    !formData.year || !formData.semester || !formData.department
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">اختر المادة</option>
                  {(formData.year ? filteredSubjectsForForm : allSubjects).map(
                    (subject) => (
                      <option key={subject.id} value={subject.name}>
                        {subject.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {summaries.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ربط بملخص (اختياري)
                  </label>
                  <select
                    value={formData.summaryId}
                    onChange={(e) =>
                      setFormData({ ...formData, summaryId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">اختر ملخصاً</option>
                    {summaries.map((summary) => (
                      <option key={summary.id} value={summary.id}>
                        {summary.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                وصف الامتحان (اختياري)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="وصف مختصر للامتحان..."
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  الأسئلة
                </h3>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إضافة سؤال
                </button>
              </div>

              {formData.questions.map((question, questionIndex) => (
                <div
                  key={questionIndex}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4"
                >
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        السؤال {questionIndex + 1}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={question.type}
                          onChange={(e) =>
                            updateQuestion(
                              questionIndex,
                              "type",
                              e.target.value,
                            )
                          }
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="multiple-choice">
                            اختيار من متعدد
                          </option>
                          <option value="true-false">صح / خطأ</option>
                        </select>
                        <button
                          onClick={() => {
                            const currentQuestion =
                              formData.questions[questionIndex];
                            const optionsText = currentQuestion.options
                              .map(
                                (o, i) =>
                                  `${String.fromCharCode(65 + i)}: ${o}`,
                              )
                              .join("\n");
                            const fullText = `السؤال: ${currentQuestion.question}\nالخيارات:\n${optionsText}\nالشرح: ${currentQuestion.explanation}`;
                            alert(
                              `معاينة المعادلات الرياضية:\n\n${fullText}\n\n(استخدم $ للمتغيرات و \\[ \\] للمعادلات المنفصلة)`,
                            );
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="معاينة سريعة"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteQuestion(questionIndex)}
                          className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={question.question}
                      onChange={(e) =>
                        updateQuestion(
                          questionIndex,
                          "question",
                          e.target.value,
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white mb-2"
                      placeholder="اكتب السؤال هنا..."
                    />
                    {/* Preview for LaTeX */}
                    {question.question && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600/30">
                        <div className="font-bold mb-2 flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-blue-500" />
                          <span>معاينة السؤال:</span>
                        </div>
                        <LatexRenderer
                          text={question.question}
                          className="text-base text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* Image Upload UI */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      صورة السؤال (اختياري)
                    </label>
                    <div className="flex items-start gap-4">
                      {question.imageUrl ? (
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                          <Image
                            src={question.imageUrl}
                            alt="Question"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(questionIndex, "imageUrl", "")
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                            title="إزالة الصورة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-6 h-6 text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              رفع صورة
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(questionIndex, file);
                            }}
                          />
                        </label>
                      )}
                      <div className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                        <p>
                          يمكنك رفع صورة للسؤال إذا كان يحتوي على معادلات معقدة
                          أو رسوم بيانية.
                        </p>
                        <p className="mt-1">الصيغ المدعومة: JPG, PNG, WebP</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      الخيارات
                    </label>
                    {question.type === "true-false" ? (
                      <div className="flex gap-4">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={optionIndex}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                              question.correctAnswer === optionIndex
                                ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
                                : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() =>
                                updateQuestion(
                                  questionIndex,
                                  "correctAnswer",
                                  optionIndex,
                                )
                              }
                              className="text-blue-600"
                            />
                            <span className="text-gray-900 dark:text-white font-medium">
                              {option}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <React.Fragment>
                        {question.options.map((option, optionIndex) => (
                          <React.Fragment key={optionIndex}>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="radio"
                                name={`correct-${questionIndex}`}
                                checked={question.correctAnswer === optionIndex}
                                onChange={() =>
                                  updateQuestion(
                                    questionIndex,
                                    "correctAnswer",
                                    optionIndex,
                                  )
                                }
                                className="text-blue-600"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) =>
                                  updateOption(
                                    questionIndex,
                                    optionIndex,
                                    e.target.value,
                                  )
                                }
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                placeholder={`الخيار ${optionIndex + 1}`}
                              />
                            </div>
                            {option && (
                              <div className="mr-8 mb-3 text-sm p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/30 dark:border-blue-800/30">
                                <LatexRenderer text={option} />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      شرح الإجابة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={question.explanation}
                      onChange={(e) =>
                        updateQuestion(
                          questionIndex,
                          "explanation",
                          e.target.value,
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="شرح لماذا هذه الإجابة صحيحة..."
                    />
                    {question.explanation && (
                      <div className="mt-2 text-sm p-2 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100/30 dark:border-green-800/30">
                        <LatexRenderer text={question.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingQuiz(null);
                  setFormData({
                    title: "",
                    description: "",
                    durationMinutes: "",
                    department: "",
                    year: "",
                    semester: "",
                    subject: "",
                    summaryId: "",
                    questions: [
                      {
                        question: "",
                        options: ["", "", "", ""],
                        correctAnswer: 0,
                        explanation: "",
                        type: "multiple-choice",
                        imageUrl: "",
                      },
                    ],
                  });
                }}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={
                  !formData.title.trim() ||
                  !formData.department ||
                  !formData.year ||
                  !formData.subject.trim() ||
                  formData.questions.some((q) => !q.question.trim())
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingQuiz ? "تحديث الامتحان" : "إنشاء الامتحان"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredQuizzes.map((quiz: Quiz) => (
          <div
            key={quiz.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex flex-col h-full border-2 border-purple-500"
          >
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                  {quiz.title}
                </h3>
                <span className="shrink-0 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800">
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

              <div className="space-y-2 mb-6">
                <div className="flex flex-wrap gap-2 text-xs">
                  {(() => {
                    try {
                      const parsed = JSON.parse(quiz.description || "{}");
                      const dept = parsed.department || quiz.department;
                      const year = parsed.year || quiz.year;

                      return (
                        <>
                          {dept && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-md">
                              {dept}
                            </span>
                          )}
                          {year && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-md">
                              {year}
                            </span>
                          )}
                        </>
                      );
                    } catch {
                      return (
                        <>
                          {quiz.department && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-md">
                              {quiz.department}
                            </span>
                          )}
                          {quiz.year && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-md">
                              {quiz.year}
                            </span>
                          )}
                        </>
                      );
                    }
                  })()}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                  {(() => {
                    try {
                      const parsed = JSON.parse(quiz.description || "{}");
                      return parsed.description || "لا يوجد وصف";
                    } catch {
                      return quiz.description || "لا يوجد وصف";
                    }
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-auto">
              <button
                onClick={() => router.push(`/quiz-play/${quiz.id}`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-bold shadow-lg shadow-green-500/20"
              >
                <Play className="w-4 h-4" />
                ابدأ
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => handleEditQuiz(quiz)}
                    className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    title="تعديل"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد امتحانات
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            ابدأ بإنشاء امتحان جديد
          </p>
        </div>
      )}

      {quizzes.length > 0 && filteredQuizzes.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            لا توجد نتائج
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            جرّب تغيير الفلاتر أو مسحها
          </p>
        </div>
      )}
    </div>
  );
}
