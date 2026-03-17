import { supabase } from "../lib/supabase";
import { Subject } from "../types/database";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "../contexts/AuthContext";
import { usePlatformSettings } from "./usePlatformSettings";
import { logger } from "../lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type UseSubjectsParams = {
    level?: number | null;
    semester?: number | null;
    is_academic?: boolean;
};

export function useSubjects(params: UseSubjectsParams = {}) {
    const { academic, loading: academicLoading } = useUserAcademic();
    const { activeSemester } = usePlatformSettings();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const isAcademicParam = params.is_academic !== undefined ? params.is_academic : true;
    const isAnonymous = !user;
    const effectiveLevel = typeof params.level === "number" ? params.level : (academic.level ?? 1);
    const effectiveSemester = typeof params.semester === "number"
        ? params.semester
        : (Number(activeSemester) || Number(academic.semester) || 1);

    const queryKey = ['subjects', {
        level: effectiveLevel,
        semester: effectiveSemester,
        isAnonymous,
        isAcademic: isAcademicParam
    }];

    const { data: subjects = [], isLoading: loading, refetch: fetchSubjects } = useQuery({
        queryKey,
        enabled: !academicLoading && (isAcademicParam ? params.level !== null : true),
        staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
        queryFn: async () => {
            try {
                const query = supabase
                    .from("subjects")
                    .select("id, name, name_en, is_academic, semester, level, show_on_home, created_at, professor, description, schedule, location, status")
                    .order("name", { ascending: true });

                const { data, error } = await query;
                if (error) throw error;

                const subjectData = (data as Subject[]) || [];

                return subjectData.filter((s) => {
                    if (isAcademicParam === false) {
                        if (s.is_academic === true) return false;
                    } else {
                        if (s.is_academic === false) return false;
                    }

                    const semesterMatch = s.semester === undefined || s.semester === null || 
                        Number(s.semester) === Number(effectiveSemester);

                    const levelMatch = s.level === undefined || s.level === null || 
                        Number(s.level) === Number(effectiveLevel);

                    const visibilityMatch = isAnonymous ? Boolean(s.show_on_home) : true;

                    return semesterMatch && levelMatch && visibilityMatch;
                });
            } catch (error) {
                logger.error("Failed to fetch subjects", error, {
                    params,
                    level: effectiveLevel,
                    semester: effectiveSemester
                });
                return [];
            }
        }
    });

    const updateSubjectVisibilityMutation = useMutation({
        mutationFn: async ({ id, showOnHome }: { id: string, showOnHome: boolean }) => {
            const { error } = await supabase
                .from("subjects")
                .update({ show_on_home: showOnHome })
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
        },
        onError: (error) => {
            logger.error("Failed to update subject visibility", error);
        }
    });

    const updateSubjectMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Subject> }) => {
            const { error } = await supabase.from("subjects").update(data).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
        },
    });

    const createSubjectMutation = useMutation({
        mutationFn: async (data: Partial<Subject>) => {
            const { error } = await supabase.from("subjects").insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
        },
    });

    const deleteSubjectMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("subjects").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
        },
    });

    return {
        subjects,
        loading,
        fetchSubjects: () => fetchSubjects(),
        updateSubjectVisibility: (id: string, showOnHome: boolean) =>
            updateSubjectVisibilityMutation.mutateAsync({ id, showOnHome }),
        updateSubject: (id: string, data: Partial<Subject>) =>
            updateSubjectMutation.mutateAsync({ id, data }),
        createSubject: (data: Partial<Subject>) => createSubjectMutation.mutateAsync(data),
        deleteSubject: (id: string) => deleteSubjectMutation.mutateAsync(id),
    };
}
