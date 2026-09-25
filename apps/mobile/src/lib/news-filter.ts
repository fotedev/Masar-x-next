/**
 * News category filtering (spec 020 C2/T101) — mirrors the web /news
 * tabs. `type` holds announcement | update | important | custom; items
 * with a `custom_category` carry their own label and appear ONLY under
 * the "all" tab (the web tabs filter strictly by `type`).
 */

export type NewsCategory = "all" | "announcement" | "update" | "important";

export interface NewsFilterRow {
  type?: string | null;
  custom_category?: string | null;
}

/** Strict category match: "all" passes everything, others need exact type equality. */
export function matchesCategory(
  row: NewsFilterRow,
  selected: NewsCategory,
): boolean {
  if (selected === "all") return true;
  return (row.type ?? "").trim() === selected;
}

/**
 * Chip label for a card: custom-typed items surface their own
 * `custom_category`; the three fixed types render via i18n keys in the
 * screen, so this returns null for them.
 */
export function customCategoryLabel(row: NewsFilterRow): string | null {
  if ((row.type ?? "").trim() !== "custom") return null;
  const label = (row.custom_category ?? "").trim();
  return label || null;
}
