import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { inferLectureKeyFromTitle } from "@/utils/lecture-inference";
import { logger } from "@/lib/logger";

export interface ContentItem {
  id: string;
  title: string;
  subject: string;
  url?: string;
  file_url?: string;
  description?: string | null;
  language?: string;
  created_at: string;
  status?: string;
  lecture_key?: string | null;
  lecture_id?: string | null;
  type: "video" | "file" | "summary" | "quiz";
}

interface UseLectureContentProps {
  show: boolean;
  subject: string;
  lecture: { id: string; lecture_key: string } | null;
  lecturesIndex: { id: string; title: string; lecture_key: string }[];
}

export function useLectureContent({
  show,
  subject,
  lecture,
  lecturesIndex,
}: UseLectureContentProps) {
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [files, setFiles] = useState<ContentItem[]>([]);
  const [quizzes, setQuizzes] = useState<ContentItem[]>([]);

  const lectureKey = (lecture?.lecture_key || "").trim() || "other";

  useEffect(() => {
    if (!show || !subject || !lecture) return;

    async function fetchAll() {
      try {
        setLoading(true);

        const [summariesRes, videosRes, filesRes, quizzesRes] =
          await Promise.all([
            supabase
              .from("summaries")
              .select("id,title,subject,status,created_at,lecture_key,lecture_id")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("videos")
              .select("id,title,subject,url,language,created_at,lecture_key,lecture_id")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("files")
              .select(
                "id,title,subject,file_url,description,created_at,lecture_key,lecture_id",
              )
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("quizzes")
              .select("id,title,subject,description,created_at,lecture_id")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(500),
          ]);

        if (summariesRes.error) throw summariesRes.error;
        if (videosRes.error) throw videosRes.error;
        if (filesRes.error) throw filesRes.error;
        if (quizzesRes.error) throw quizzesRes.error;

        const lectureMatch = (row: { lecture_id?: string | null; lecture_key?: string | null; title?: string | null; id: string }) => {
          // 1. Match by ID (most reliable)
          if (lecture?.id && row.lecture_id === lecture.id) return true;

          // 2. Match by Key (fallback for older records)
          if (
            row.lecture_key &&
            String(row.lecture_key).trim() === String(lectureKey).trim()
          )
            return true;

          // 3. Inference fallback
          try {
            const inferredKey = inferLectureKeyFromTitle(
              row?.title || "",
              lecturesIndex,
            );
            return inferredKey === lectureKey;
          } catch (inferenceError) {
            logger.error("Inference failed for row:", { rowId: row.id, error: inferenceError });
            return false;
          }
        };

        setSummaries((summariesRes.data || []).map((s: Omit<ContentItem, 'type'>) => ({ ...s, type: 'summary' as const })).filter(lectureMatch));
        setVideos((videosRes.data || []).map((v: Omit<ContentItem, 'type'>) => ({ ...v, type: 'video' as const })).filter(lectureMatch));
        setFiles((filesRes.data || []).map((f: Omit<ContentItem, 'type'>) => ({ ...f, type: 'file' as const })).filter(lectureMatch));

        const quizzesForSubject = quizzesRes.data || [];
        setQuizzes(quizzesForSubject.map((q: Omit<ContentItem, 'type'>) => ({ ...q, type: 'quiz' as const })).filter(lectureMatch));
      } catch (e) {
        logger.error("Error fetching lecture content:", e);
        setSummaries([]);
        setVideos([]);
        setFiles([]);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [lecture, lectureKey, lecturesIndex, show, subject]);

  return {
    loading,
    summaries,
    videos,
    files,
    quizzes,
    setSummaries,
    setVideos,
    setFiles,
    setQuizzes,
    lectureKey,
  };
}
