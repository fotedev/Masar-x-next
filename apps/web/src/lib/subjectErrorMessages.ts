import { getPostgrestMessage, isUniqueViolation } from "./postgrestError";

type Translate = (key: string) => string;

/**
 * Maps a failed \`subjects\` save to the message shown to the user.
 *
 * Supabase throws \`PostgrestError\` plain objects (not \`Error\` instances), so the
 * raw backend text must be read from the object shape. \`subjects.name\` is UNIQUE
 * (migration 003), so a 23505 / duplicate-key failure becomes a clear, localized
 * "pick another name" message instead of a generic save failure.
 */
export function resolveSubjectSaveError(err: unknown, t: Translate): string {
  const message = getPostgrestMessage(err);
  const isDuplicateName =
    isUniqueViolation(err, "subjects_name_key") ||
    message.includes("subjects_name_key");

  return isDuplicateName ? t("duplicateName") : message || t("saveErrorFallback");
}
