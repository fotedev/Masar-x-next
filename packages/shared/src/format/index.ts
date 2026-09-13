/**
 * Locale-aware date formatting for the cross-platform apps.
 *
 * The product's dominant rendering is a numeric year / named month /
 * numeric day pattern, previously hand-rolled per component with
 * drifting options. This helper owns one implementation; callers pass
 * the app locale and the variant they render.
 */

export interface FormatDateOptions {
  /** BCP-47 locale tag. Defaults to "ar-EG" (the product's primary). */
  locale?: string;
  /** Month rendering length. Defaults to "short". */
  month?: "short" | "long";
  /** Append 2-digit hour/minute to the date (for last-activity stamps). */
  withTime?: boolean;
}

export function formatDate(
  input: string | Date | number,
  options: FormatDateOptions = {},
): string {
  const date =
    typeof input === "string" || typeof input === "number"
      ? new Date(input)
      : input;
  return date.toLocaleDateString(options.locale ?? "ar-EG", {
    year: "numeric",
    month: options.month ?? "short",
    day: "numeric",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
