import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { News, Database } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

// Keep track of the inflight request to deduplicate simultaneous calls
let inflightRequest: Promise<News[]> | null = null;

export function useNews() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddNews, setShowAddNews] = useState(false);
  const [newNews, setNewNews] = useState<
    Database["public"]["Tables"]["news"]["Insert"]
  >({
    title: "",
    content: "",
    type: "announcement",
    priority: 0,
    created_by: null,
  });

  const fetchNews = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);

      const cacheKey = cacheKeys.news();

      // Check cache first
      if (!skipCache) {
        const cached = queryCache.get<News[]>(cacheKey);
        if (cached) {
          setNews(cached);
          setLoading(false);
          return;
        }
      }

      // If there's an inflight request, wait for it instead of starting a new one
      if (inflightRequest) {
        const data = await inflightRequest;
        setNews(data);
        setLoading(false);
        return;
      }

      // Start a new request
      inflightRequest = (async () => {
        const { data, error } = await supabase
          .from("news")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) throw error;
        return data || [];
      })();

      const newsData = await inflightRequest;
      setNews(newsData);

      // Cache the result
      queryCache.set(cacheKey, newsData, cacheTTL.news);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      inflightRequest = null;
      setLoading(false);
    }
  }, []);

  const addNews = async (
    newsData: Database["public"]["Tables"]["news"]["Insert"],
    fileUrl: string | null,
    imageUrls: string[] | null,
    customCategory: string | null,
    subject: string | null = null,
    department: string | null = null,
    year: string | null = null
  ): Promise<News | null> => {
    try {
      const newsToInsert = {
        ...newsData,
        file_url: fileUrl,
        image_urls: imageUrls,
        custom_category: customCategory,
        subject: subject ?? newsData.subject,
        department: department ?? newsData.department,
        year: year ?? newsData.year,
      };

      const { data, error } = await supabase
        .from("news")
        .insert([newsToInsert])
        .select()
        .single();

      if (error) throw error;

      setNewNews({
        title: "",
        content: "",
        type: "announcement",
        priority: 0,
        created_by: null,
      });
      setShowAddNews(false);

      // Update local state directly
      if (data) {
        setNews(prev => [data, ...prev]);
      } else {
        await fetchNews(true);
      }

      // Invalidate cache
      queryCache.delete(cacheKeys.news());

      return data;
    } catch (error) {
      console.error("Error adding news:", error);
      return null;
    }
  };

  const toggleNewsStatus = async (id: string, is_active: boolean) => {
    try {
      const { error } = await supabase
        .from("news")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;

      // Update local state directly
      setNews(prev => prev.map(n => n.id === id ? { ...n, is_active } : n));

      // Invalidate cache
      queryCache.delete(cacheKeys.news());
    } catch (error) {
      console.error("Error toggling news status:", error);
    }
  };

  const deleteNews = async (id: string) => {
    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Update local state directly
      setNews(prev => prev.filter(n => n.id !== id));

      // Invalidate cache
      queryCache.delete(cacheKeys.news());
    } catch (error) {
      console.error("Error deleting news:", error);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return {
    news,
    loading,
    showAddNews,
    setShowAddNews,
    newNews,
    setNewNews,
    fetchNews,
    addNews,
    toggleNewsStatus,
    deleteNews,
  };
}
