export type LectureIndexItem = {
  key: string;
  label: string;
  order: number;
  counts: {
    summaries: number;
    videos: number;
    files: number;
    exams: number;
  };
};

type MaybeCreatedAt = { created_at?: string };

export type ContentItem = {
  id?: string;
  title: string;
  url?: string;
  file_url?: string;
  type: "video" | "file" | "summary" | "quiz";
} & MaybeCreatedAt;
