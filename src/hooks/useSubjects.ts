import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Subject } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "../contexts/AuthContext";
import { usePlatformSettings } from "./usePlatformSettings";

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
    const { activeSemester } = usePlatformSettings();
    const { user } = useAuth();

    const fetchSubjects = useCallback(async (skipCache = false) => {
        try {
            setLoading(true);

            const isAcademicParam = params.is_academic !== undefined ? params.is_academic : true;

            // Since is_academic column doesn't exist in DB, we treat all subjects as academic
            // unless explicitly requested otherwise (which wouldn't make sense without the column)

            if (isAcademicParam && (params.level === null)) {
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
                    : (Number(activeSemester) || Number(academic.semester) || 1);
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

            // Since is_academic column might not exist in some environments, but we need it for separation
            let query = supabase
                .from("subjects")
                .select("*")
                .order("name", { ascending: true });

            // If we are looking for non-academic subjects (TRW), and the column exists, filter by it.
            // However, the current issue is that useSubjects is being used for TRW but TRW has its own tables.
            // We should ideally use useTRWCategories for TRW, but the UI (SubjectsGrid) is built around useSubjects.
            
            const { data, error } = await query;

            if (error) throw error;

            const subjectData: SubjectWithSemester[] = (data as SubjectWithSemester[]) || [];

            // Filter by semester/level/academic
            const filtered = subjectData.filter((s) => {
                // If the database has is_academic column, use it. 
                // Otherwise, if we are in TRW section (is_academic: false), we shouldn't see subjects.
                const anyS = s as any;
                if (isAcademicParam === false) {
                    // This is the TRW section. If the column exists and it's true, filter it out.
                    if (anyS.is_academic === true) return false;
                    // If the column doesn't exist, we can't reliably filter by it here yet.
                    // But we definitely shouldn't show academic subjects in TRW.
                } else {
                    // This is the academic section. Filter out non-academic if the column exists.
                    if (anyS.is_academic === false) return false;
                }

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
                queryCache.set(cacheKey, filtered, cacheTTL.subjects || 3600000);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [academic.level, academic.semester, params.level, params.semester, user, activeSemester]);

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
    }, [academicLoading, activeSemester, fetchSubjects]);

    return {
        subjects,
        loading,
        fetchSubjects,
        updateSubjectVisibility,
    };
}
