// Spec 051 — conversation row timestamps: relative for the recent window,
// locale month-day past a week.
import { describe, expect, it } from "vitest";
import { formatConversationUpdatedAt } from "../conversation-time";

const NOW = Date.parse("2026-11-18T12:00:00.000Z");

describe("formatConversationUpdatedAt", () => {
  it("renders the locale's 'this minute' for sub-minute ages", () => {
    expect(formatConversationUpdatedAt("2026-11-18T11:59:59.000Z", "en", NOW)).toBe("this minute");
  });

  it("formats minutes and hours relatively", () => {
    expect(formatConversationUpdatedAt("2026-11-18T11:45:00.000Z", "en", NOW)).toBe("15 minutes ago");
    expect(formatConversationUpdatedAt("2026-11-18T09:00:00.000Z", "en", NOW)).toBe("3 hours ago");
  });

  it("formats days relatively within a week", () => {
    expect(formatConversationUpdatedAt("2026-11-16T12:00:00.000Z", "en", NOW)).toBe("2 days ago");
  });

  it("falls back to a locale month-day past a week", () => {
    expect(formatConversationUpdatedAt("2026-01-05T12:00:00.000Z", "en", NOW)).toMatch(/Jan/);
  });

  it("returns an empty string for unparsable input", () => {
    expect(formatConversationUpdatedAt("not-a-date", "en", NOW)).toBe("");
  });
});
