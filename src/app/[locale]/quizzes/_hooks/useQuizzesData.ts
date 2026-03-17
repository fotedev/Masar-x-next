import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { queryCache, cacheTTL } from "@/lib/queryCache";
import type { Quiz, Summary } from "@/types/database";
import type { QuizFormData } from "../_types";

export function useQuizzesData(props: {
  isAdmin: boolean;
  summarySubject: string;
  summaryDepartment: string;
}) {
  const { isAdmin, summarySubject, summaryDepartment } = props;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Summary[]>([]);

  const loadQuizzes = useCallback(
    async (skipCache = false) => {
      const cacheKey = `quizzes_all_admin_${isAdmin}`;
      if (!skipCache) {
        const cached = queryCache.get<Quiz[]>(cacheKey);
        if (cached) {
          setQuizzes(cached);
          setLoading(false);
          return;
        }
      }

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
        const dataRows = data || [];
        setQuizzes(dataRows);
        queryCache.set(cacheKey, dataRows, cacheTTL.quizzes || 1800000);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [isAdmin],
  );

  const fetchSummaries = useCallback(async () => {
    if (!summarySubject || !summaryDepartment) {
      setSummaries([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("subject", summarySubject)
        .eq("department", summaryDepartment)
        .eq("status", "approved");

      if (error) throw error;
      setSummaries(data || []);
    } catch {
      // ignore
    }
  }, [summarySubject, summaryDepartment]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const saveQuiz = useCallback(
    async (args: {
      userId: string;
      formData: QuizFormData;
      editingQuiz: Quiz | null;
    }) => {
      const { userId, formData, editingQuiz } = args;

      const durationMinutesNum = formData.durationMinutes
        ? Number(formData.durationMinutes)
        : null;
      const durationSeconds =
        typeof durationMinutesNum === "number" &&
        !Number.isNaN(durationMinutesNum) &&
        durationMinutesNum > 0
          ? Math.round(durationMinutesNum * 60)
          : null;

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

        return { created: false };
      }

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: formData.title,
          description: fullDescription,
          summary_id: formData.summaryId || null,
          created_by: userId,
          source_type: "manual",
          duration_seconds: durationSeconds,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = formData.questions.map((q, index) => ({
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

      return { created: true };
    },
    [],
  );

  const loadQuizForEdit = useCallback(async (quiz: Quiz) => {
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
        const obj = parsed as Record<string, unknown>;
        department = typeof obj.department === "string" ? obj.department : "";
        year = typeof obj.year === "string" ? obj.year : "";
        semester = obj.semester ? String(obj.semester) : "";
        subject = typeof obj.subject === "string" ? obj.subject : "";
        parsedDescription =
          typeof obj.description === "string" ? obj.description : "";
      }
    } catch {
      // ignore
    }

    const quizRecord = quiz as unknown as Record<string, unknown>;
    const durationSecondsRaw = quizRecord.duration_seconds;
    const durationMinutes =
      typeof durationSecondsRaw === "number"
        ? String(Math.round(durationSecondsRaw / 60))
        : "";

    const formData: QuizFormData = {
      title: quiz.title,
      description: parsedDescription,
      durationMinutes,
      department,
      year,
      semester,
      subject,
      summaryId: quiz.summary_id || "",
      questions: (questions || []).map(
        (q: NonNullable<typeof questions>[number]) => {
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
        },
      ),
    };

    return { formData };
  }, []);

  const deleteQuiz = useCallback(async (quizId: string) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
    if (error) throw error;
  }, []);

  return {
    quizzes,
    setQuizzes,
    loading,
    loadQuizzes,
    summaries,
    setSummaries,
    fetchSummaries,
    saveQuiz,
    loadQuizForEdit,
    deleteQuiz,
  };
}
