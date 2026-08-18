import { supabase } from "../lib/supabase";
import { SummaryWithRatings, SummaryUpdate } from "../types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "../lib/logger";

export interface SummaryWithRatingsOptimistic extends SummaryWithRatings {
  isOptimistic?: boolean;
}

export function useSummaries() {
  const queryClient = useQueryClient();

  const { data: summaries = [], isLoading: loading, refetch: fetchSummaries } = useQuery({
    queryKey: ['summaries'],
    staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("summaries_with_ratings")
          .select("*")
          .order("avg_rating", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        logger.error("Failed to fetch summaries", error);
        return [];
      }
    }
  });

  const addOptimisticSummary = (summary: SummaryWithRatingsOptimistic) => {
    queryClient.setQueryData(['summaries'], (old: SummaryWithRatingsOptimistic[] | undefined) => {
      return old ? [summary, ...old] : [summary];
    });
  };

  const removeOptimisticSummary = (id: string) => {
    queryClient.setQueryData(['summaries'], (old: SummaryWithRatingsOptimistic[] | undefined) => {
      return old?.filter(s => s.id !== id);
    });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("summaries")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
    onError: (error) => {
      logger.error("Failed to update summary status", error);
    }
  });

  const editSummaryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<SummaryUpdate> }) => {
      const { error } = await supabase
        .from("summaries")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
    onError: (error) => {
      logger.error("Failed to edit summary", error);
    }
  });

  const deleteSummaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('summaries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['summaries'] });
      const previousSummaries = queryClient.getQueryData(['summaries']);
      
      queryClient.setQueryData(['summaries'], (old: SummaryWithRatings[] | undefined) => {
        return old?.filter(s => s.id !== id);
      });

      return { previousSummaries };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSummaries) {
        queryClient.setQueryData(['summaries'], context.previousSummaries);
      }
      logger.error("Failed to delete summary", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    }
  });

  const clearAllSummariesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('summaries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
    onError: (error) => {
      logger.error("Failed to clear all summaries", error);
    }
  });

  const canEditSummary = (summary: SummaryWithRatings, currentUserId: string | null, isAdmin: boolean) => {
    if (!currentUserId) return false;
    return isAdmin || summary.user_id === currentUserId;
  };

  const canDeleteSummary = (summary: SummaryWithRatings, currentUserId: string | null, isAdmin: boolean) => {
    if (!currentUserId) return false;
    return isAdmin || summary.user_id === currentUserId;
  };

  return {
    summaries,
    loading,
    fetchSummaries: () => fetchSummaries(),
    addOptimisticSummary,
    removeOptimisticSummary,
    updateStatus: (id: string, status: "approved" | "rejected") => 
      updateStatusMutation.mutateAsync({ id, status }),
    editSummary: (id: string, updates: Partial<SummaryUpdate>) => 
      editSummaryMutation.mutateAsync({ id, updates }),
    canEditSummary,
    canDeleteSummary,
    deleteSummary: (id: string) => deleteSummaryMutation.mutateAsync(id),
    clearAllSummaries: () => clearAllSummariesMutation.mutateAsync(),
  };
}
