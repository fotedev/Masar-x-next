import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Subject } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

export function useSubjects() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubjects = useCallback(async (skipCache = false) => {
        try {
            setLoading(true);
            const cacheKey = cacheKeys.subjects ? cacheKeys.subjects() : "subjects";

            // Check cache first
            if (!skipCache && queryCache.get) {
                const cached = queryCache.get<Subject[]>(cacheKey);
                if (cached) {
                    setSubjects(cached);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await supabase
                .from("subjects")
                .select("*")
                .order("name", { ascending: true });

            if (error) throw error;

            const subjectData = data || [];
            setSubjects(subjectData);

            // Cache the result
            if (queryCache.set) {
                queryCache.set(cacheKey, subjectData, cacheTTL.subjects || 3600);
            }
        } catch (error) {
            console.error("Error fetching subjects:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSubjectVisibility = async (id: string, showOnHome: boolean) => {
        try {
            const { error } = await supabase
                .from("subjects")
                .update({ show_on_home: showOnHome })
                .eq("id", id);

            if (error) throw error;

            // Update local state
            setSubjects(prev => prev.map(s => s.id === id ? { ...s, show_on_home: showOnHome } : s));

            // Invalidate cache
            const cacheKey = cacheKeys.subjects ? cacheKeys.subjects() : "subjects";
            if (queryCache.delete) {
                queryCache.delete(cacheKey);
            }
        } catch (error) {
            console.error("Error updating subject visibility:", error);
            throw error;
        }
    };

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    return {
        subjects,
        loading,
        fetchSubjects,
        updateSubjectVisibility,
    };
}
