import type { ContentItem as CanonicalContentItem } from "@/hooks/useLectureContent";

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

/**
 * Projection of the canonical ContentItem (hooks/useLectureContent — spec 041
 * P1.7): the lecture-detail sections render a subset of its fields, so this
 * type is derived from it instead of being a second divergent duplicate.
 */
export type ContentItem = Pick<
  CanonicalContentItem,
  "id" | "title" | "url" | "file_url" | "type" | "created_at"
>;
