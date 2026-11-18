/**
 * Short relative stamp for a conversation row (spec 051): "just now",
 * minutes/hours/days via Intl.RelativeTimeFormat (locale-aware, I3), and a
 * locale month-day fallback past a week. Pure logic — unit-testable in
 * isolation, no React.
 */
export const formatConversationUpdatedAt = (
  iso: string,
  locale: string,
  now: number = Date.now(),
): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMinutes = Math.round((now - then) / 60_000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMinutes < 1) return relative.format(0, "minute");
  if (diffMinutes < 60) return relative.format(-diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return relative.format(-diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return relative.format(-diffDays, "day");
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso));
};
