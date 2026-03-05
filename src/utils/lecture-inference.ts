/**
 * Shared utility for lecture key inference
 * Used by ManageLecturesModal and subjects/[subject]/page.tsx
 * to ensure consistent lecture matching logic
 */

export interface LectureInfo {
  key: string;
  label: string;
  order: number;
}

interface SavedLecture {
  id: string;
  lecture_key: string;
  lecture_label: string;
  order_index: number;
}

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
 * Get lecture info from title or quiz description
 * Falls back through multiple heuristics to find the best match
 */
export function getLectureInfoFromTitle(
  title: string,
  quizDescription?: string,
  savedLectures: SavedLecture[] = []
): LectureInfo {
  // 0. Check if it's a quiz with lecture_key in description
  if (quizDescription && quizDescription.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(quizDescription);
      if (parsed.lecture_key) {
        const matchingLecture = savedLectures.find(
          (l) => l.lecture_key === parsed.lecture_key
        );
        return {
          key: parsed.lecture_key,
          label: matchingLecture?.lecture_label || "محاضرة",
          order: matchingLecture?.order_index || 999999,
        };
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  const t = (title || "").trim();
  if (!t) {
    return {
      key: "other",
      label: "غير مصنف",
      order: 999999,
    };
  }

  // 1. Check if the title matches a saved lecture exactly (label or key)
  const exactMatch = savedLectures.find(
    (l) =>
      l.lecture_label.trim().toLowerCase() === t.toLowerCase() ||
      l.lecture_key.trim().toLowerCase() === t.toLowerCase()
  );
  if (exactMatch) {
    return {
      key: exactMatch.lecture_key,
      label: exactMatch.lecture_label,
      order: exactMatch.order_index,
    };
  }

  // 1.5 Check if the title starts with a saved lecture's key
  const keyPrefixMatch = savedLectures.find((l) =>
    t.toLowerCase().startsWith(l.lecture_key.trim().toLowerCase())
  );
  if (keyPrefixMatch) {
    return {
      key: keyPrefixMatch.lecture_key,
      label: keyPrefixMatch.lecture_label,
      order: keyPrefixMatch.order_index,
    };
  }

  // 2. Check if the title starts with a saved lecture's label
  const prefixMatch = savedLectures.find((l) =>
    t.toLowerCase().startsWith(l.lecture_label.trim().toLowerCase())
  );
  if (prefixMatch) {
    return {
      key: prefixMatch.lecture_key,
      label: prefixMatch.lecture_label,
      order: prefixMatch.order_index,
    };
  }

  // 3. Pattern matching for "محاضرة 1" or "Lecture 1" format
  const patterns: Array<{
    re: RegExp;
    labelPrefix: string;
  }> = [
    {
      re: /(محاضرة|محاضره)\s*([0-9٠-٩]+(?:\s*و\s*[0-9٠-٩]+)*)/i,
      labelPrefix: "محاضرة",
    },
    {
      re: /(lecture|lec|week)\s*([0-9٠-٩]+(?:\s*(?:&|and|-)\s*[0-9٠-٩]+)*)/i,
      labelPrefix: "Lecture",
    },
  ];

  for (const p of patterns) {
    const m = t.match(p.re);
    if (!m) continue;

    const rawNumPart = (m[2] || "").trim();
    const latin = toLatinDigits(rawNumPart);
    const firstNumberMatch = latin.match(/\d+/);
    const order = firstNumberMatch ? Number(firstNumberMatch[0]) : 999999;
    const normalizedKeyPart = latin
      .replace(/\s*و\s*/g, "-")
      .replace(/\s*(?:&|and)\s*/gi, "-")
      .replace(/\s+/g, "")
      .replace(/[^0-9-]/g, "");
    const key = normalizedKeyPart ? `lec-${normalizedKeyPart}` : "other";

    return {
      key,
      label: `${p.labelPrefix} ${rawNumPart}`,
      order: Number.isFinite(order) ? order : 999999,
    };
  }

  return {
    key: "other",
    label: "غير مصنف",
    order: 999999,
  };
}

/**
 * Infer lecture key from title (for ManageLecturesModal compatibility)
 * Returns just the key string
 */
export function inferLectureKeyFromTitle(
  title: string,
  lecturesIndex: Array<{ lecture_key?: string; lecture_label?: string }> = []
): string {
  const t = (title || "").trim();
  if (!t) return "other";

  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedTitle = clean(t);

  // 1. Exact match (case-insensitive)
  const exact = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.lecture_label || "");
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
    (a, b) => (b.lecture_label?.length || 0) - (a.lecture_label?.length || 0)
  );

  // 2. Delimiter match for prefixes/suffixes
  const titleParts = t.split(/[:\-\|]/).map((p) => clean(p));

  for (const part of titleParts) {
    if (!part || part.length < 2) continue;
    const match = sortedLectures.find((l) => {
      const key = (l.lecture_key || "").trim().toLowerCase();
      const label = clean(l.lecture_label || "");
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
    const label = clean(l.lecture_label || "");
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

  return "other";
}
