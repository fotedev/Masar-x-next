import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Subject } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";
import { usePlatformSettings } from "./usePlatformSettings";

export function useSubjects() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const { activeSemester, loading: semesterLoading } = usePlatformSettings();

    const fetchSubjects = useCallback(async (skipCache = false) => {
        try {
            setLoading(true);
            const cacheKeyBase = cacheKeys.subjects ? cacheKeys.subjects() : "subjects";
            const cacheKey = `${cacheKeyBase}:sem:${activeSemester}`;

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

            const subjectData: any[] = data || [];

            // Filter by semester if present on subjects or platform setting
            const filtered = subjectData.filter((s) => {
                // If subject has semester column, match it. If not present, include it.
                if (s.semester === undefined || s.semester === null) return true;
                return Number(s.semester) === Number(activeSemester || 1);
            });

            setSubjects(filtered);

            // Cache the result
            if (queryCache.set) {
                queryCache.set(cacheKey, filtered, cacheTTL.subjects || 3600);
            }
        } catch (error) {
            console.error("Error fetching subjects:", error);
        } finally {
            setLoading(false);
        }
    }, [activeSemester]);

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
            const cacheKeyBase = cacheKeys.subjects ? cacheKeys.subjects() : "subjects";
            const cacheKey = `${cacheKeyBase}:sem:${activeSemester}`;
            if (queryCache.delete) {
                queryCache.delete(cacheKey);
            }
        } catch (error) {
            console.error("Error updating subject visibility:", error);
            throw error;
        }
    };

    useEffect(() => {
        if (!semesterLoading) {
            fetchSubjects();
        }
    }, [semesterLoading, fetchSubjects]);

    return {
        subjects,
        loading,
        fetchSubjects,
        updateSubjectVisibility,
    };
}
