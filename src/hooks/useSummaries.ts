import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { SummaryWithRatings, SummaryUpdate } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

// Keep track of the inflight request to deduplicate simultaneous calls
let inflightRequest: Promise<SummaryWithRatings[]> | null = null;

export function useSummaries() {
  const [summaries, setSummaries] = useState<SummaryWithRatings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummaries = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);

      const cacheKey = cacheKeys.summaries();

      // Check cache first
      if (!skipCache) {
        const cached = queryCache.get<SummaryWithRatings[]>(cacheKey);
        if (cached) {
          setSummaries(cached);
          setLoading(false);
          return;
        }
      }

      // If there's an inflight request, wait for it instead of starting a new one
      if (inflightRequest) {
        const data = await inflightRequest;
        setSummaries(data);
        setLoading(false);
        return;
      }

      // Start a new request
      inflightRequest = (async () => {
        const { data, error } = await supabase
          .from("summaries_with_ratings")
          .select("*")
          .order("avg_rating", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      })();

      const summaryData = await inflightRequest;
      setSummaries(summaryData);

      // Cache the result
      queryCache.set(cacheKey, summaryData, cacheTTL.summaries);
    } catch {
      // ignore
    } finally {
      inflightRequest = null;
      setLoading(false);
    }
  }, []);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("summaries")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // Update local state directly
      setSummaries(prev => prev.map(s => s.id === id ? { ...s, status } : s));

      // Invalidate cache
      queryCache.delete(cacheKeys.summaries());
    } catch {
      // ignore
    }
  };

  const editSummary = async (id: string, updates: Partial<SummaryUpdate>) => {
    try {
      const { error } = await supabase
        .from("summaries")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Update local state directly
      setSummaries(prev => prev.map(s => s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s));

      // Invalidate cache
      queryCache.delete(cacheKeys.summaries());
    } catch (error) {
      throw error;
    }
  };

  const canEditSummary = (summary: SummaryWithRatings, currentUserId: string | null, isAdmin: boolean) => {
    if (!currentUserId) return false;
    return isAdmin || summary.user_id === currentUserId;
  };

  const canDeleteSummary = (summary: SummaryWithRatings, currentUserId: string | null, isAdmin: boolean) => {
    if (!currentUserId) return false;
    return isAdmin || summary.user_id === currentUserId;
  };

  const deleteSummary = async (id: string) => {
    try {
      const { error } = await supabase
        .from('summaries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local state directly
      setSummaries(prev => prev.filter(s => s.id !== id));

      // Invalidate cache
      queryCache.delete(cacheKeys.summaries());
    } catch {
      // ignore
    }
  };

  const clearAllSummaries = async () => {
    try {
      const { error } = await supabase
        .from('summaries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      // Update local state directly
      setSummaries([]);

      // Invalidate cache
      queryCache.delete(cacheKeys.summaries());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    summaries,
    loading,
    fetchSummaries,
    updateStatus,
    editSummary,
    canEditSummary,
    canDeleteSummary,
    deleteSummary,
    clearAllSummaries,
  };
}
