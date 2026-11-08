/**
 * Shared utility for lecture key inference.
 * Used by subjects/[subject]/page.tsx and useLectureContent to keep
 * lecture matching logic consistent.
 */

/**
 * Convert Arabic digits to Latin digits
 */
export function toLatinDigits(value: string): string {
  return (value || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim();
}

/**
 * Normalize text for comparison
 */
export function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infer lecture key from title (for ManageLecturesModal compatibility)
 * Returns just the key string
 */
export function inferLectureKeyFromTitle(
  title: string,
  lecturesIndex: { id: string; title: string; lecture_key: string }[]
): string | null {
  const t = (title || "").trim();
  if (!t) return "other";

  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedTitle = clean(t);

  // 1. Exact match (case-insensitive)
  const exact = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.title || "");
    return (
      (key && key === normalizedTitle) || (label && label === normalizedTitle)
    );
  });
  if (exact?.lecture_key) return exact.lecture_key;

  // 1.5 Prefix match against lecture_key
  const keyPrefix = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    if (!key) return false;
    return normalizedTitle.startsWith(key);
  });
  if (keyPrefix?.lecture_key) return keyPrefix.lecture_key;

  // Sort lectures by label length descending to match most specific/longest first
  const sortedLectures = [...lecturesIndex].sort(
    (a, b) => (b.title?.length || 0) - (a.title?.length || 0)
  );

  // 2. Delimiter match for prefixes/suffixes
  const titleParts = t.split(/[:\-\|]/).map((p) => clean(p));

  for (const part of titleParts) {
    if (!part || part.length < 2) continue;
    const match = sortedLectures.find((l) => {
      const key = (l.lecture_key || "").trim().toLowerCase();
      const label = clean(l.title || "");
      return (
        (key &&
          (key === part || part.startsWith(key) || key.startsWith(part))) ||
        (label &&
          (label === part || part.includes(label) || label.includes(part)))
      );
    });
    if (match?.lecture_key) return match.lecture_key;
  }

  // 3. Substring match
  const partial = sortedLectures.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.title || "");
    if (key && key.length >= 2) {
      if (normalizedTitle.includes(key) || key.includes(normalizedTitle))
        return true;
    }
    if (label && label.length >= 2) {
      return normalizedTitle.includes(label) || label.includes(normalizedTitle);
    }
    return false;
  });
  if (partial?.lecture_key) return partial.lecture_key;

  return null;
}
