type Translate = (key: string) => string;

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

/**
 * Maps a failed `subjects` save to the message shown to the user.
 *
 * Supabase throws `PostgrestError` plain objects (not `Error` instances), so the
 * raw backend text must be read from the object shape. `subjects.name` is UNIQUE
 * (migration 003), so a 23505 / duplicate-key failure becomes a clear, localized
 * "pick another name" message instead of a generic save failure.
 */
export function resolveSubjectSaveError(err: unknown, t: Translate): string {
  const pgError = (err ?? {}) as PostgrestLikeError;
  const message = err instanceof Error ? err.message : pgError.message ?? "";
  const rawDetail = [pgError.message, pgError.details]
    .filter(Boolean)
    .join(" ");

  const isDuplicateName =
    pgError.code === "23505" ||
    message.includes("duplicate key") ||
    rawDetail.includes("duplicate key") ||
    rawDetail.includes("subjects_name_key");

  return isDuplicateName ? t("duplicateName") : message || t("saveErrorFallback");
}
