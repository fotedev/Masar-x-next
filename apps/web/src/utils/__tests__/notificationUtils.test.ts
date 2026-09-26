import { describe, expect, it } from "vitest";
import {
  formatTimeAgo,
  getNotificationIcon,
  getNotificationPriority,
  shouldHighlightNotification,
} from "../notificationUtils";
import type { Notification } from "@/types/database";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const mkT = (): TFn => (key, vars) =>
  key === "timeAgo.now" ? "now" : `${key}:${vars?.count ?? ""}`;

describe("formatTimeAgo", () => {
  it("says 'now' for timestamps less than a minute old", () => {
    expect(formatTimeAgo(new Date().toISOString(), mkT())).toBe("now");
  });

  it("buckets minutes / hours / days", () => {
    const minutesAgo = (m: number) =>
      new Date(Date.now() - m * 60_000).toISOString();
    expect(formatTimeAgo(minutesAgo(5), mkT())).toBe("timeAgo.minutesAgo:5");
    expect(formatTimeAgo(minutesAgo(120), mkT())).toBe("timeAgo.hoursAgo:2");
    expect(formatTimeAgo(minutesAgo(60 * 24 * 3), mkT())).toBe("timeAgo.daysAgo:3");
  });

  it("beyond a week falls back to a locale date string", () => {
    const out = formatTimeAgo(
      new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString(),
      mkT(),
      "en-US",
    );
    expect(out).not.toMatch(/timeAgo/);
    expect(out.length).toBeGreaterThan(4);
  });
});

describe("notification helpers", () => {
  const base = {
    id: "n1",
    user_id: "u1",
    title: "t",
    body: "b",
    read: true,
    type: "system",
    created_at: "2025-01-01",
  } as unknown as Notification;

  it("maps known types to icons with a bell default", () => {
    expect(getNotificationIcon("admin_submission")).toBe("📝");
    expect(getNotificationIcon("content_published")).toBe("📰");
    expect(getNotificationIcon("system")).toBe("⚙️");
    expect(getNotificationIcon("unknown-type")).toBe("🔔");
  });

  it("system notifications are high priority", () => {
    expect(getNotificationPriority({ ...base, type: "system" })).toBe("high");
    expect(getNotificationPriority({ ...base, type: "content_published" })).toBe("normal");
  });

  it("unread or system notifications are highlighted", () => {
    expect(shouldHighlightNotification({ ...base, read: false })).toBe(true);
    expect(shouldHighlightNotification({ ...base, type: "system" })).toBe(true);
    expect(shouldHighlightNotification({ ...base, read: true, type: "content_published" })).toBe(false);
  });
});
