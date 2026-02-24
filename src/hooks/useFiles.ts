import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

interface File {
  id: string;
  subject: string;
  title: string;
  file_url: string;
  description: string | null;
  user_id: string;
  created_at: string;
  lecture_key?: string | null;
  lecture_id?: string | null;
}

export function useFiles(subject?: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async (skipCache = false) => {
    if (!subject) {
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const cacheKeyBase = cacheKeys.files ? cacheKeys.files() : "files";
      const cacheKey = `${cacheKeyBase}:subject:${subject}`;

      // Check cache first
      if (!skipCache && queryCache.get) {
        const cached = queryCache.get<File[]>(cacheKey);
        if (cached) {
          setFiles(cached);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("subject", subject)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const fileData: File[] = data || [];
      setFiles(fileData);

      // Cache the result
      if (queryCache.set) {
        queryCache.set(cacheKey, fileData, cacheTTL.files);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    loading,
    fetchFiles,
  };
}
