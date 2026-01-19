import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Appeal } from "../types/database";
import { useNotifications } from "./useNotifications";
import { useAuth } from "../contexts/AuthContext";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

// Keep track of the inflight request to deduplicate simultaneous calls
let inflightRequest: Promise<Appeal[]> | null = null;

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);

  const { notifyUser } = useNotifications();
  const { user } = useAuth();

  const fetchAppeals = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);

      const cacheKey = cacheKeys.appeals();

      // Check cache first
      if (!skipCache) {
        const cached = queryCache.get<Appeal[]>(cacheKey);
        if (cached) {
          setAppeals(cached);
          setLoading(false);
          return;
        }
      }

      // If there's an inflight request, wait for it instead of starting a new one
      if (inflightRequest) {
        const data = await inflightRequest;
        setAppeals(data);
        setLoading(false);
        return;
      }

      // Start a new request
      inflightRequest = (async () => {
        const { data, error } = await supabase
          .from("appeals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) throw error;
        return data || [];
      })();

      const appealsData = await inflightRequest;
      setAppeals(appealsData);

      // Cache the result
      queryCache.set(cacheKey, appealsData, cacheTTL.appeals);
    } catch (error) {
      console.error("Error fetching appeals:", error);
    } finally {
      inflightRequest = null;
      setLoading(false);
    }
  }, []);
  const deleteAppeal = useCallback(async (id: string) => {
    try {
      if (!confirm("هل أنت متأكد أنك تريد حذف هذا الطعن؟")) return;

      const { error } = await supabase.from("appeals").delete().eq("id", id);

      if (error) throw error;

      setAppeals((prev) => prev.filter((appeal) => appeal.id !== id));
    } catch (error) {
      console.error("Error deleting appeal:", error);
      alert("حدث خطأ أثناء حذف الطعن.");
    }
  }, []);

  const acceptAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    try {
      if (!confirm("هل أنت متأكد أنك تريد قبول هذا الطعن؟")) return;

      const { error } = await supabase
        .from("appeals")
        .update({ status: "accepted", reviewed_by: user?.id })
        .eq("id", id);

      if (error) throw error;

      setAppeals((prev) =>
        prev.map((appeal) =>
          appeal.id === id ? { ...appeal, status: "accepted" } : appeal
        )
      );
      notifyUser(
        userId,
        "تم قبول طعنك!",
        `تم قبول طعنك على ${contentTitle}. شكرا لمساهمتك. `,
        "appeal_status_update",
        id,
        "appeal"
      );
    } catch (error) {
      console.error("Error accepting appeal:", error);
      alert("حدث خطأ أثناء قبول الطعن.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rejectAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    try {
      if (!confirm("هل أنت متأكد أنك تريد رفض هذا الطعن؟")) return;

      const { error } = await supabase
        .from("appeals")
        .update({ status: "rejected", reviewed_by: user?.id })
        .eq("id", id);

      if (error) throw error;

      setAppeals((prev) =>
        prev.map((appeal) =>
          appeal.id === id ? { ...appeal, status: "rejected" } : appeal
        )
      );
      notifyUser(
        userId,
        "تم رفض طعنك.",
        `تم رفض طعنك على ${contentTitle}. يمكنك مراجعة السبب إذا تم توفيره. `,
        "appeal_status_update",
        id,
        "appeal"
      );
    } catch (error) {
      console.error("Error rejecting appeal:", error);
      alert("حدث خطأ أثناء رفض الطعن.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAppeals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    appeals,
    loading,
    fetchAppeals,
    deleteAppeal,
    acceptAppeal,
    rejectAppeal,
  };
}
