import { supabase } from "../lib/supabase";
import { Subject as DBSubject } from "@/types/database";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { useAuth } from "../contexts/AuthContext";
import { useEffectiveSemester } from "./useEffectiveSemester";
import { logger } from "../lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Subject extends DBSubject {
  isOptimistic?: boolean;
}

// Phase 1 of refactor/decouple-trw-subjects:
// subjects table is now exclusively for academic subjects.
// TRW (non-academic) content lives behind /non-academic and is served
// by useTRWCategories + useTRWMembership — see hooks/trw/*.
// Therefore the is_academic param was removed from this hook entirely.
type UseSubjectsParams = {
  level?: number | null;
  semester?: number | null;
};

export function useSubjects(params: UseSubjectsParams = {}) {
  const { academic, loading: academicLoading } = useUserAcademic();
  // Spec 013: the STUDENT's own profile semester drives the catalog view
  // (guests keep a localStorage choice; everyone falls back to the platform
  // default). The old global active_semester override is gone.
  const { effectiveSemester: resolvedSemester } = useEffectiveSemester(
    academic.semester,
  );
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const isAnonymous = !user;
  // Always coerced to a number — never undefined/null reaches PostgREST syntax.
  const effectiveLevel = Number(
    typeof params.level === "number" ? params.level : (academic.level ?? 1),
  );
  const effectiveSemester = Number(
    typeof params.semester === "number" ? params.semester : resolvedSemester,
  );

  const queryKey = [
    "subjects",
    {
      level: effectiveLevel,
      semester: effectiveSemester,
      isAnonymous,
      isAdmin,
    },
  ];

  const {
    data: subjects = [],
    isLoading: loading,
    refetch: fetchSubjects,
  } = useQuery({
    queryKey,
    // Admins manage every subject regardless of their own academic profile —
    // scoping the admin grid to the signed-in admin's level/semester hid
    // subjects they had just created (MVP launch blocker).
    enabled: isAdmin
      ? true
      : !academicLoading && params.level !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
    queryFn: async () => {
      try {
        let query = supabase
          .from("subjects")
          .select(
            "id, name, name_en, semester, level, show_on_home, created_at, professor, description, schedule, location, status",
          )
          .order("name", { ascending: true });

        if (!isAdmin) {
          // subjects table is academic-only since refactor/decouple-trw-subjects.
          // The NULL-OR filter is kept so legacy rows without level/semester
          // remain visible (back-compat until Phase 2 migration drops them).
          query = query.or(`level.eq.${effectiveLevel},level.is.null`);
          query = query.or(`semester.eq.${effectiveSemester},semester.is.null`);
        }

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
        // Phase 1: subjects are academic-only; explicitly null the legacy
        // column so the type narrows cleanly until Phase 2 migration drops it.
        is_academic: null,
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
        // Intentionally NO spread of newSubject — callers may still pass
        // is_academic through newSubject (legacy admin form), but we don't
        // want a legacy field to leak into the academic-only catalog.
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
