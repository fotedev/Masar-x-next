import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { News, NewsInsert } from "../types/database";
import { logger } from "../lib/logger";
import { toast } from "sonner";
import { useState } from "react";

type UseNewsOptions = {
  includeInactive?: boolean;
};

export function useNews(options: UseNewsOptions = {}) {
  const { includeInactive = false } = options;
  const queryClient = useQueryClient();
  const [showAddNews, setShowAddNews] = useState(false);
  const [newNews, setNewNews] = useState<NewsInsert>({
    title: "",
    content: "",
    type: "announcement",
    priority: 0,
    created_by: null,
  });

  const queryKey = ["news", { includeInactive }];

  const { data: news = [], isLoading: loading, refetch: fetchNews } = useQuery({
    queryKey,
    queryFn: async () => {
      const query = supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      const { data, error } = includeInactive
        ? await query
        : await query.eq("is_active", true);

      if (error) throw error;
      return (data as News[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addNewsMutation = useMutation({
    mutationFn: async (newsToInsert: NewsInsert) => {
      const { data, error } = await supabase
        .from("news")
        .insert([newsToInsert])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setNewNews({
        title: "",
        content: "",
        type: "announcement",
        priority: 0,
        created_by: null,
      });
      setShowAddNews(false);
      toast.success("تمت إضافة الخبر بنجاح");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء إضافة الخبر";
      logger.error(`Failed to add news: ${errorMessage}`, { error });
      toast.error(errorMessage);
    },
  });

  const toggleNewsStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("news")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast.success("تم تحديث حالة الخبر");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء تحديث حالة الخبر";
      logger.error(`Failed to toggle news status: ${errorMessage}`, { error });
      toast.error(errorMessage);
    },
  });

  const deleteNewsMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast.success("تم حذف الخبر بنجاح");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء حذف الخبر";
      logger.error(`Failed to delete news: ${errorMessage}`, { error });
      toast.error(errorMessage);
    },
  });

  return {
    news,
    loading,
    showAddNews,
    setShowAddNews,
    newNews,
    setNewNews,
    fetchNews: () => fetchNews(),
    addNews: (
      newsData: NewsInsert,
      fileUrl: string | null,
      imageUrls: string[] | null,
      customCategory: string | null
    ) => addNewsMutation.mutateAsync({
      ...newsData,
      file_url: fileUrl,
      image_urls: imageUrls,
      custom_category: customCategory,
    }),
    toggleNewsStatus: (id: string, is_active: boolean) =>
      toggleNewsStatusMutation.mutateAsync({ id, is_active }),
    deleteNews: (id: string) => deleteNewsMutation.mutateAsync(id),
  };
}
