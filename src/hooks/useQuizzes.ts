import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { QuizWithRatings } from "../types/database";
import { queryCache, cacheTTL } from "../lib/queryCache";

// Keep track of the inflight request to deduplicate simultaneous calls
let inflightRequest: Promise<QuizWithRatings[]> | null = null;

export function useQuizzes() {
    const [quizzes, setQuizzes] = useState<QuizWithRatings[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQuizzes = useCallback(async (skipCache = false) => {
        try {
            setLoading(true);

            const cacheKey = "admin_quizzes_v2"; // Custom cache key for admin view

            // Check cache first
            if (!skipCache) {
                const cached = queryCache.get<QuizWithRatings[]>(cacheKey);
                if (cached) {
                    setQuizzes(cached);
                    setLoading(false);
                    return;
                }
            }

            // If there's an inflight request, wait for it instead of starting a new one
            if (inflightRequest) {
                const data = await inflightRequest;
                setQuizzes(data);
                setLoading(false);
                return;
            }

            // Start a new request
            inflightRequest = (async () => {
                const { data, error } = await supabase
                    .from("quizzes_with_ratings")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (error) throw error;
                return data || [];
            })();

            const quizData = await inflightRequest;
            setQuizzes(quizData);

            // Cache the result
            queryCache.set(cacheKey, quizData, cacheTTL.summaries); // Reuse summaries TTL
        } catch (error) {
            console.error("Error fetching quizzes:", error);
        } finally {
            inflightRequest = null;
            setLoading(false);
        }
    }, []);

    const deleteQuiz = async (id: string) => {
        try {
            if (!confirm("هل أنت متأكد أنك تريد حذف هذا الامتحان؟")) return;

            const { error } = await supabase
                .from("quizzes")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // Update local state directly
            setQuizzes(prev => prev.filter(q => q.id !== id));

            // Invalidate cache
            queryCache.delete("admin_quizzes_v2");
        } catch (error) {
            console.error("Error deleting quiz:", error);
            alert("حدث خطأ أثناء حذف الامتحان.");
        }
    };

    const updateStatus = async (id: string, status: "approved" | "rejected") => {
        try {
            const { error } = await supabase
                .from("quizzes")
                .update({ status })
                .eq("id", id);

            if (error) throw error;

            // Invalidate cache first
            queryCache.delete("admin_quizzes_v2");
            
            // Refetch quizzes to get fresh data from database
            await fetchQuizzes(true);
        } catch (error) {
            console.error("Error updating quiz status:", error);
            alert("حدث خطأ أثناء تحديث حالة الامتحان.");
        }
    };

    useEffect(() => {
        fetchQuizzes();
    }, [fetchQuizzes]);

    return {
        quizzes,
        loading,
        fetchQuizzes,
        deleteQuiz,
        updateStatus,
    };
}
