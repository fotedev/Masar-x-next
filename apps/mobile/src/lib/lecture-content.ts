/**
 * Lecture-content matching for the mobile subject-detail screen
 * (spec 019 C2/T078) — a faithful port of the web matcher in
 * apps/web/src/hooks/useLectureContent.ts (match by lecture_id first,
 * then by trimmed lecture_key against the lecture's resolved key,
 * where an empty lecture key resolves to "other"), minus the
 * title-inference fallback, which stays web-only: rows matching no
 * lecture land in an explicit "unclassified" group so content is
 * never silently dropped.
 *
 * Row interfaces are intentionally local (mobile convention for tables
 * absent from the hand-typed packages/shared Database — same pattern
 * as src/types/quiz.ts; the shared Supabase client is schema-loose).
 */

export interface LectureRef {
  id: string;
  lecture_key: string;
  lecture_label: string;
}

export interface MatchableRow {
  id: string;
  title: string;
  lecture_key?: string | null;
  lecture_id?: string | null;
}

export interface LectureContentGroups<S, V, F, Q> {
  summaries: S[];
  videos: V[];
  files: F[];
  quizzes: Q[];
}

/** The lecture's effective key: trimmed; empty falls back to "other". */
export function resolveLectureKey(lecture: Pick<LectureRef, "lecture_key">): string {
  return (lecture.lecture_key || "").trim() || "other";
}

/**
 * Faithful port of the web matcher's non-inference rules:
 *  1. lecture_id equality (most reliable);
 *  2. trimmed lecture_key equality with the lecture's resolved key —
 *     rows WITHOUT a key never key-match (they are unclassified), even
 *     when the lecture itself resolves to "other" (web line 90 guard).
 */
export function matchesLecture(
  row: MatchableRow,
  lecture: Pick<LectureRef, "id" | "lecture_key">,
): boolean {
  if (lecture.id && row.lecture_id === lecture.id) return true;
  const rowKey = (row.lecture_key || "").trim();
  if (rowKey && rowKey === resolveLectureKey(lecture)) return true;
  return false;
}

export interface GroupedContent<
  S extends MatchableRow,
  V extends MatchableRow,
  F extends MatchableRow,
  Q extends MatchableRow,
> {
  byLectureId: Record<string, LectureContentGroups<S, V, F, Q>>;
  unclassified: LectureContentGroups<S, V, F, Q>;
}

function emptyGroups<S, V, F, Q>(): LectureContentGroups<S, V, F, Q> {
  return { summaries: [], videos: [], files: [], quizzes: [] };
}

/**
 * Group subject-wide content rows per lecture. Selection then reads
 * `byLectureId[lecture.id]` with no refetch; `unclassified` is rendered
 * as its own always-visible section (web parity minus inference).
 */
export function groupContentByLecture<
  S extends MatchableRow,
  V extends MatchableRow,
  F extends MatchableRow,
  Q extends MatchableRow,
>(
  lectures: LectureRef[],
  rows: { summaries: S[]; videos: V[]; files: F[]; quizzes: Q[] },
): GroupedContent<S, V, F, Q> {
  const byLectureId: Record<string, LectureContentGroups<S, V, F, Q>> = {};
  for (const lecture of lectures) {
    byLectureId[lecture.id] = emptyGroups<S, V, F, Q>();
  }
  const unclassified = emptyGroups<S, V, F, Q>();

  const place = <R extends MatchableRow>(
    row: R,
    kind: "summaries" | "videos" | "files" | "quizzes",
  ): void => {
    // Global grouping honors the web matcher's own priority: lecture_id
    // is "most reliable" and wins over any key match, regardless of
    // lecture order (a row whose id points at lecture B must land in B
    // even when its key matches lecture A).
    const byId = row.lecture_id
      ? lectures.find((l) => l.id === row.lecture_id)
      : undefined;
    const rowKey = (row.lecture_key || "").trim();
    const byKey = rowKey
      ? lectures.find((l) => resolveLectureKey(l) === rowKey)
      : undefined;
    const target = byId ?? byKey;
    // TS cannot correlate `kind` with the S/V/F/Q type parameters; the
    // push target is exactly R[] by construction.
    const bucket = target
      ? byLectureId[target.id][kind]
      : unclassified[kind];
    (bucket as unknown as R[]).push(row);
  };

  rows.summaries.forEach((row) => place(row, "summaries"));
  rows.videos.forEach((row) => place(row, "videos"));
  rows.files.forEach((row) => place(row, "files"));
  rows.quizzes.forEach((row) => place(row, "quizzes"));

  return { byLectureId, unclassified };
}
