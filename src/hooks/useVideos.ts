import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

interface Video {
  id: string;
  subject: string;
  title: string;
  url: string;
  language: "ar" | "en";
  user_id: string;
  created_at: string;
  lecture_key?: string | null;
  lecture_id?: string | null;
}

export function useVideos(subject?: string) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async (skipCache = false) => {
    if (!subject) {
      setVideos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const cacheKeyBase = cacheKeys.videos ? cacheKeys.videos() : "videos";
      const cacheKey = `${cacheKeyBase}:subject:${subject}`;

      // Check cache first
      if (!skipCache && queryCache.get) {
        const cached = queryCache.get<Video[]>(cacheKey);
        if (cached) {
          setVideos(cached);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("subject", subject)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const videoData: Video[] = data || [];
      setVideos(videoData);

      // Cache the result
      if (queryCache.set) {
        queryCache.set(cacheKey, videoData, cacheTTL.videos);
      }
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    loading,
    fetchVideos,
  };
}
