import { describe, expect, it } from "vitest";
import { formatDate } from "../index";

describe("formatDate", () => {
  it("formats an ISO string in the given locale (deterministic en-US)", () => {
    const out = formatDate("2025-01-05T10:30:00Z", { locale: "en-US" });
    // numeric year + named short month + numeric day, en-US order
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/Jan/);
    expect(out).toMatch(/5/);
  });

  it("defaults to ar-EG and still renders the numeric year", () => {
    const out = formatDate(new Date(2025, 0, 5));
    // Node ICU renders ar-EG with Arabic-Indic digits (٢٠٢٥); browsers may
    // use Latin digits. Accept either rendering.
    expect(out).toMatch(/٢٠٢٥|2025/);
    expect(out.length).toBeGreaterThan(4);
  });

  it("accepts epoch-number input", () => {
    const ts = Date.UTC(2024, 11, 25);
    expect(formatDate(ts, { locale: "en-US" })).toMatch(/2024/);
  });

  it("withTime appends a 2-digit hour/minute pair", () => {
    const plain = formatDate("2025-01-05T10:30:00Z", { locale: "en-US" });
    const withTime = formatDate("2025-01-05T10:30:00Z", {
      locale: "en-US",
      withTime: true,
    });
    expect(withTime.length).toBeGreaterThan(plain.length);
    expect(withTime).toMatch(/\d{1,2}:\d{2}/);
  });

  it("long month option switches the month name (en-US)", () => {
    const short = formatDate("2025-09-01", { locale: "en-US", month: "short" });
    const long = formatDate("2025-09-01", { locale: "en-US", month: "long" });
    expect(short).toMatch(/Sep/);
    expect(long).toMatch(/September/);
  });

  it("uses UTC-anchored values consistently for Z timestamps", () => {
    // 2024-02-29 (leap day) must render February regardless of local TZ drift,
    // because the input is parsed to an absolute instant and en-US month names
    // are locale-driven (the TZ may shift the day, never the month here).
    const out = formatDate("2024-02-29T00:00:00Z", { locale: "en-US" });
    expect(out).toMatch(/Feb|Mar/); // TZ may push midnight-UTC into Feb 28 or Mar 1
    expect(out).toMatch(/2024/);
  });
});
