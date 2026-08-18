import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { VideoWithRatings } from "../types/database";

export function useVideoRatings(videoId?: string) {
  const [videos, setVideos] = useState<VideoWithRatings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideoRatings = useCallback(
    async () => {
      if (!videoId) {
        setVideos([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("lectures_with_ratings")
          .select("*")
          .eq("id", videoId)
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

        setVideos(data ? [data] : []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    },
    [videoId]
  );

  useEffect(() => {
    fetchVideoRatings();
  }, [fetchVideoRatings]);

  return {
    videos,
    loading,
    fetchVideoRatings,
    videoData: videos.length > 0 ? videos[0] : null,
  };
}

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
