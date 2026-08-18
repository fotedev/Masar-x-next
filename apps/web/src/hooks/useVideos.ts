import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";
import { useQuery } from "@tanstack/react-query";

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
  const { data: videos = [], isLoading: loading, refetch: fetchVideos } = useQuery({
    queryKey: ['videos', subject],
    enabled: !!subject,
    staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("videos")
          .select("*")
          .eq("subject", subject)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as Video[]) || [];
      } catch (error) {
        logger.error("Failed to fetch videos", error, { subject });
        return [];
      }
    }
  });

  return {
    videos,
    loading,
    fetchVideos: () => fetchVideos(),
  };
}
