import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { VideoWithRatings } from "../types/database";

export function useTopVideos(limit = 10) {
  const [videos, setVideos] = useState<VideoWithRatings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopVideos = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("lectures_with_ratings")
          .select("*")
          .order("avg_rating", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        setVideos(data || []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopVideos();
  }, [limit]);

  return {
    videos,
    loading,
  };
}
