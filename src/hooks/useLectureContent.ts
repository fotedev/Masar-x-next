import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { inferLectureKeyFromTitle } from "@/utils/lecture-inference";

interface UseLectureContentProps {
  show: boolean;
  subject: string;
  lecture: any | null;
  lecturesIndex: any[];
}

export function useLectureContent({
  show,
  subject,
  lecture,
  lecturesIndex,
}: UseLectureContentProps) {
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

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
              .select("id,title,description,created_at,lecture_id")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(500),
          ]);

        if (summariesRes.error) throw summariesRes.error;
        if (videosRes.error) throw videosRes.error;
        if (filesRes.error) throw filesRes.error;
        if (quizzesRes.error) throw quizzesRes.error;

        const lectureMatch = (row: any) => {
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
            console.error("Inference failed for row:", row.id, inferenceError);
            return false;
          }
        };

        setSummaries((summariesRes.data || []).filter(lectureMatch));
        setVideos((videosRes.data || []).filter(lectureMatch));
        setFiles((filesRes.data || []).filter(lectureMatch));

        const quizzesForSubject = quizzesRes.data || [];
        setQuizzes(quizzesForSubject.filter(lectureMatch));
      } catch (e) {
        console.error("Error fetching lecture content:", e);
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
