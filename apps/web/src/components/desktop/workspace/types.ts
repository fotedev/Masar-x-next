/**
 * Workspace shape definitions for the desktop study workspace.
 *
 * Spec 005 FR-001..009: lecture list + reader + assistant in one window,
 * no window-level scroll, RTL/LTR mirroring via logical sides.
 *
 * Types here map from existing subject/summary data; no new schema is
 * introduced (T010 in tasks.md).
 */

import type { ContentItem } from "@/hooks/useLectureContent";

/**
 * One lecture as the sidebar presents it. Built from
 * `subject_lectures` joined with optional document metadata derived
 * from the corresponding `files` row.
 */
export interface WorkspaceLecture {
  id: string;
  title: string;
  ordinal: number;
  /** Lecture key (used to look up content via `useLectureContent`). */
  lectureKey: string;
  /** Embedded document URL (the first file matching this lecture), if any. */
  documentUrl?: string;
  documentTitle?: string;
  /** Optional lecture duration in seconds; UI may display it. */
  duration?: number;
  /** Counts surfaced as small badges in the sidebar row. */
  counts?: {
    summaries: number;
    videos: number;
    files: number;
    quizzes: number;
  };
}

/**
 * The transient selection state for one open workspace. Session-scoped;
 * not persisted (per "Workspace selection" key entity in spec).
 */
export interface WorkspaceSelection {
  lectureId: string | null;
  /** Whether the assistant panel is expanded. Default false. */
  assistantOpen: boolean;
}

export interface StudyWorkspaceProps {
  subjectName: string;
  lectures: WorkspaceLecture[];
  /** Optional lecture to open on mount. Defaults to the first lecture. */
  initialLectureId?: string;
  /**
   * The currently-selected lecture's content, hydrated by
   * `useLectureContent` upstream. The workspace renders whatever the
   * caller supplies so the same data shape as the existing
   * `LectureDetailView` is reused.
   */
  currentContent?: {
    summaries: ContentItem[];
    videos: ContentItem[];
    files: ContentItem[];
    quizzes: ContentItem[];
  };
  /** Loading flag forwarded from the upstream content hook. */
  contentLoading?: boolean;
  /**
   * Fired when the student picks a different lecture. The host page
   * owns the data fetch (useLectureContent); the workspace only
   * reflects selection. Allows the host to debounce / revalidate.
   */
  onSelectLecture?: (lectureId: string) => void;
}
