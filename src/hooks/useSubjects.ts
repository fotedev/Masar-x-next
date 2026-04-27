import { supabase } from "../lib/supabase";
import { Subject as DBSubject } from "@/types/database";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "../contexts/AuthContext";
import { usePlatformSettings } from "./usePlatformSettings";
import { logger } from "../lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Subject extends DBSubject {
  isOptimistic?: boolean;
}

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

  const isAcademicParam =
    params.is_academic !== undefined ? params.is_academic : true;
  const isAnonymous = !user;
  const effectiveLevel =
    typeof params.level === "number" ? params.level : (academic.level ?? 1);
  const effectiveSemester =
    typeof params.semester === "number"
      ? params.semester
      : Number(activeSemester) || Number(academic.semester) || 1;

  const queryKey = [
    "subjects",
    {
      level: effectiveLevel,
      semester: effectiveSemester,
      isAnonymous,
      isAcademic: isAcademicParam,
    },
  ];

  const {
    data: subjects = [],
    isLoading: loading,
    refetch: fetchSubjects,
  } = useQuery({
    queryKey,
    enabled:
      !academicLoading && (isAcademicParam ? params.level !== null : true),
    staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
    queryFn: async () => {
      try {
        let query = supabase
          .from("subjects")
          .select(
            "id, name, name_en, is_academic, semester, level, show_on_home, created_at, professor, description, schedule, location, status",
          )
          .order("name", { ascending: true });

        if (isAcademicParam === true) {
          query = query.or("is_academic.eq.true,is_academic.is.null");
        } else {
          query = query.or("is_academic.eq.false,is_academic.is.null");
        }

        query = query.or(`level.eq.${effectiveLevel},level.is.null`);
        query = query.or(`semester.eq.${effectiveSemester},semester.is.null`);

        if (isAnonymous) {
          query = query.eq("show_on_home", true);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data as Subject[]) || [];
      } catch (error) {
        logger.error("Failed to fetch subjects", error, {
          params,
          level: effectiveLevel,
          semester: effectiveSemester,
        });
        return [];
      }
    },
  });

  const updateSubjectVisibilityMutation = useMutation({
    mutationFn: async ({
      id,
      showOnHome,
    }: {
      id: string;
      showOnHome: boolean;
    }) => {
      const { error } = await supabase
        .from("subjects")
        .update({ show_on_home: showOnHome })
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async ({ id, showOnHome }) => {
      await queryClient.cancelQueries({ queryKey: ["subjects"] });
      const previousSubjects = queryClient.getQueryData(["subjects"]);

      queryClient.setQueriesData(
        { queryKey: ["subjects"] },
        (old: Subject[] | undefined) => {
          return old?.map((s) =>
            s.id === id ? { ...s, show_on_home: showOnHome } : s,
          );
        },
      );

      return { previousSubjects };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSubjects) {
        queryClient.setQueriesData(
          { queryKey: ["subjects"] },
          context.previousSubjects,
        );
      }
      logger.error("Failed to update subject visibility", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Subject>;
    }) => {
      const { error } = await supabase
        .from("subjects")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["subjects"] });
      const previousSubjects = queryClient.getQueryData(["subjects"]);

      queryClient.setQueriesData(
        { queryKey: ["subjects"] },
        (old: Subject[] | undefined) => {
          return old?.map((s) => (s.id === id ? { ...s, ...data } : s));
        },
      );

      return { previousSubjects };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSubjects) {
        queryClient.setQueriesData(
          { queryKey: ["subjects"] },
          context.previousSubjects,
        );
      }
      logger.error("Failed to update subject", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (data: Partial<Subject>) => {
      const { data: inserted, error } = await supabase
        .from("subjects")
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return inserted;
    },
    onMutate: async (newSubject) => {
      await queryClient.cancelQueries({ queryKey: ["subjects"] });
      const previousSubjects = queryClient.getQueryData(["subjects"]);

      const optimisticSubject: Subject = {
        id: `optimistic-${Date.now()}`,
        name: newSubject.name || "",
        name_en: newSubject.name_en || "",
        is_academic: newSubject.is_academic ?? true,
        semester: newSubject.semester || 1,
        level: newSubject.level || 1,
        show_on_home: newSubject.show_on_home ?? true,
        created_at: new Date().toISOString(),
        status: "approved",
        isOptimistic: true,
        professor: newSubject.professor || null,
        professor_ar: null,
        professor_gender: null,
        description: newSubject.description || null,
        description_ar: null,
        schedule: newSubject.schedule || null,
        location: newSubject.location || null,
        ...newSubject,
      };

      queryClient.setQueriesData(
        { queryKey: ["subjects"] },
        (old: Subject[] | undefined) => {
          return old ? [optimisticSubject, ...old] : [optimisticSubject];
        },
      );

      return { previousSubjects };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSubjects) {
        queryClient.setQueriesData(
          { queryKey: ["subjects"] },
          context.previousSubjects,
        );
      }
      logger.error("Failed to create subject", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["subjects"] });
      const previousSubjects = queryClient.getQueryData(["subjects"]);

      queryClient.setQueriesData(
        { queryKey: ["subjects"] },
        (old: Subject[] | undefined) => {
          return old?.filter((s) => s.id !== id);
        },
      );

      return { previousSubjects };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSubjects) {
        queryClient.setQueriesData(
          { queryKey: ["subjects"] },
          context.previousSubjects,
        );
      }
      logger.error("Failed to delete subject", error);
    },
    onSettled: () => {
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
    createSubject: (data: Partial<Subject>) =>
      createSubjectMutation.mutateAsync(data),
    deleteSubject: (id: string) => deleteSubjectMutation.mutateAsync(id),
  };
}
