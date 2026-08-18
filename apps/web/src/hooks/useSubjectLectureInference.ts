import { useCallback } from "react";

type Translator = (key: string) => string;

export type SubjectLectureRow = {
  id: string;
  subject: string;
  lecture_key: string;
  lecture_label: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

type LectureInfo = {
  key: string;
  label: string;
  order: number;
};

function toLatinDigits(value: string) {
  return (value || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim();
}

export function useSubjectLectureInference(params: {
  savedLectures: SubjectLectureRow[];
  tSubjectPage: Translator;
}) {
  const { savedLectures, tSubjectPage } = params;

  const getLectureInfoFromTitle = useCallback(
    (title: string, quizDescription?: string): LectureInfo => {
      if (quizDescription && quizDescription.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(quizDescription);
          if (parsed.lecture_key) {
            const matchingLecture = savedLectures.find(
              (l) => l.lecture_key === parsed.lecture_key,
            );
            return {
              key: parsed.lecture_key,
              label: matchingLecture?.lecture_label || tSubjectPage("lecture"),
              order: matchingLecture?.order_index || 999999,
            };
          }
        } catch {
          // ignore
        }
      }

      const t = (title || "").trim();
      if (!t) {
        return {
          key: "other",
          label: tSubjectPage("uncategorized"),
          order: 999999,
        };
      }

      const exactMatch = savedLectures.find(
        (l) =>
          l.lecture_label.trim().toLowerCase() === t.toLowerCase() ||
          l.lecture_key.trim().toLowerCase() === t.toLowerCase(),
      );
      if (exactMatch) {
        return {
          key: exactMatch.lecture_key,
          label: exactMatch.lecture_label,
          order: exactMatch.order_index,
        };
      }

      const keyPrefixMatch = savedLectures.find((l) =>
        t.toLowerCase().startsWith(l.lecture_key.trim().toLowerCase()),
      );
      if (keyPrefixMatch) {
        return {
          key: keyPrefixMatch.lecture_key,
          label: keyPrefixMatch.lecture_label,
          order: keyPrefixMatch.order_index,
        };
      }

      const prefixMatch = savedLectures.find((l) =>
        t.toLowerCase().startsWith(l.lecture_label.trim().toLowerCase()),
      );
      if (prefixMatch) {
        return {
          key: prefixMatch.lecture_key,
          label: prefixMatch.lecture_label,
          order: prefixMatch.order_index,
        };
      }

      const patterns: Array<{ re: RegExp; labelPrefix: string }> = [
        {
          re: /(محاضرة|محاضره)\s*([0-9٠-٩]+(?:\s*و\s*[0-9٠-٩]+)*)/i,
          labelPrefix: tSubjectPage("lecture"),
        },
        {
          re: /(lecture|lec|week)\s*([0-9٠-٩]+(?:\s*(?:&|and|-)\s*[0-9٠-٩]+)*)/i,
          labelPrefix: tSubjectPage("lecture"),
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
        label: tSubjectPage("uncategorized"),
        order: 999999,
      };
    },
    [savedLectures, tSubjectPage],
  );

  return { getLectureInfoFromTitle };
}
