import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Subject } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "../contexts/AuthContext";

type UseSubjectsParams = {
    level?: number | null;
    semester?: number | null;
    is_academic?: boolean;
};

type SubjectWithSemester = Subject & {
    semester?: string | number | null;
};

export function useSubjects(params: UseSubjectsParams = {}) {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const { academic, loading: academicLoading } = useUserAcademic();
    const { user } = useAuth();

    const fetchSubjects = useCallback(async (skipCache = false) => {
        try {
            setLoading(true);
            
            const isAcademicParam = params.is_academic !== undefined ? params.is_academic : true;

            if (isAcademicParam && (params.level === null || params.semester === null)) {
                setSubjects([]);
                setLoading(false);
                return;
            }
            const isAnonymous = !user;
            const effectiveLevel =
                typeof params.level === "number" ? params.level : (academic.level ?? 1);
            const effectiveSemester =
                typeof params.semester === "number"
                    ? params.semester
                    : (academic.semester ?? 2);
            const cacheKeyBase = cacheKeys.subjects ? cacheKeys.subjects() : "subjects";
            const cacheKey = `${cacheKeyBase}:lvl:${effectiveLevel}:sem:${effectiveSemester}:anon:${isAnonymous ? 1 : 0}:acad:${isAcademicParam}`;

            // Check cache first
            if (!skipCache && queryCache.get) {
                const cached = queryCache.get<Subject[]>(cacheKey);
                if (cached) {
                    setSubjects(cached);
                    setLoading(false);
                    return;
                }
            }

            let query = supabase
                .from("subjects")
                .select("*")
                .order("name", { ascending: true });

            // Fetch all subjects and filter in memory to avoid PostgREST syntax errors
            // and ensure all academic subjects (including those with NULL is_academic) are caught.
            const { data, error } = await query;

            if (error) throw error;

            const subjectData: SubjectWithSemester[] = (data as SubjectWithSemester[]) || [];

            // Filter by is_academic and then by semester/level
            const filtered = subjectData.filter((s) => {
                const subjectIsAcademic = s.is_academic !== false; // Treat true and NULL as academic

                if (isAcademicParam !== subjectIsAcademic) return false;

                if (!isAcademicParam) {
                    const visibilityMatch = isAnonymous ? Boolean(s.show_on_home) : true;
                    return visibilityMatch;
                }

                // For academic subjects, we check if they belong to the current level/semester
                const semesterMatch = (() => {
                    if (s.semester === undefined || s.semester === null) return true;
                    return Number(s.semester) === Number(effectiveSemester);
                })();

                const levelMatch = (() => {
                    const anyS = s as unknown as { level?: number | null };
                    if (anyS.level === undefined || anyS.level === null) return true;
                    return Number(anyS.level) === Number(effectiveLevel);
                })();

                const visibilityMatch = isAnonymous ? Boolean(s.show_on_home) : true;

                return semesterMatch && levelMatch && visibilityMatch;
            });

            setSubjects(filtered as Subject[]);

            // Cache the result
            if (queryCache.set) {
                queryCache.set(cacheKey, filtered, cacheTTL.subjects || 3600);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [academic.level, academic.semester, params.level, params.semester, user]);

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
            const cacheKey = `${cacheKeyBase}:lvl:${academic.level ?? 1}:sem:${academic.semester ?? 1}`;
            if (queryCache.delete) {
                queryCache.delete(cacheKey);
            }
        } catch (error) {
            throw error;
        }
    };

    useEffect(() => {
        if (!academicLoading) {
            fetchSubjects();
        }
    }, [academicLoading, fetchSubjects]);

    return {
        subjects,
        loading,
        fetchSubjects,
        updateSubjectVisibility,
    };
}
