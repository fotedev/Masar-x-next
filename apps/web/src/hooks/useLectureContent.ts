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

        // Spec 034 Track B (audit FETCH-1): scope each table to THIS
        // lecture server-side via lecture_id/lecture_key (composite index
        // `subject, lecture_id` covers the shape) instead of downloading
        // up to 1,700 subject rows and filtering client-side. Legacy rows
        // linked only by title inference cannot appear in a scoped query —
        // a scoped table that comes back EMPTY re-fetches broadly and
        // falls through to the full lectureMatch below.
        const lectureFilter = `lecture_id.eq.${lecture?.id},lecture_key.eq.${lectureKey}`;
        const fetchTable = async (
          table: "summaries" | "videos" | "files" | "quizzes",
          select: string,
          limit: number,
        ): Promise<Omit<ContentItem, "type">[]> => {
          const scoped = await supabase
            .from(table)
            .select(select)
            .eq("subject", subject)
            .or(lectureFilter)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (scoped.error) throw scoped.error;
          if ((scoped.data ?? []).length > 0) {
            return scoped.data as unknown as Omit<ContentItem, "type">[];
          }

          // Empty scoped result → legacy/inference-only rows may exist:
          // fall back to the historical broad fetch + client-side filter.
          const broad = await supabase
            .from(table)
            .select(select)
            .eq("subject", subject)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (broad.error) throw broad.error;
          return broad.data as unknown as Omit<ContentItem, "type">[];
        };

        const [summariesData, videosData, filesData, quizzesData] =
          await Promise.all([
            fetchTable(
              "summaries",
              "id,title,subject,status,created_at,lecture_key,lecture_id",
              400,
            ),
            fetchTable(
              "videos",
              "id,title,subject,url,language,created_at,lecture_key,lecture_id",
              400,
            ),
            fetchTable(
              "files",
              "id,title,subject,file_url,description,created_at,lecture_key,lecture_id",
              400,
            ),
            fetchTable(
              "quizzes",
              "id,title,subject,description,created_at,lecture_key,lecture_id",
              500,
            ),
          ]);


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
            // Inference is best-effort — log as warning rather than error to
            // reduce noise in Vercel/Sentry dashboards. The row simply won't
            // match this lecture; the next lecture (or admin re-fetch) will
            // re-evaluate it.
            logger.warn("Lecture inference failed for row", {
              rowId: row.id,
              error:
                inferenceError instanceof Error
                  ? inferenceError.message
                  : String(inferenceError),
            });
            return false;
          }
        };

        setSummaries(summariesData.map((s) => ({ ...s, type: 'summary' as const })).filter(lectureMatch));
        setVideos(videosData.map((v) => ({ ...v, type: 'video' as const })).filter(lectureMatch));
        setFiles(filesData.map((f) => ({ ...f, type: 'file' as const })).filter(lectureMatch));

        setQuizzes(quizzesData.map((q) => ({ ...q, type: 'quiz' as const })).filter(lectureMatch));
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
