import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CHAT_RATE_LIMIT, checkAIChatRateLimit, recordAIChatRequest } from "../rate-limit";

// No durable-store env vars are set in tests → the in-memory backend is the
// decision layer. Each test uses a unique userId because the module-level
// projection Map persists across tests in the same file.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkAIChatRateLimit (in-memory backend)", () => {
  it("allows requests under the configured maximum and reports remaining", () => {
    const user = `u-allow-${Math.random()}`;
    const first = checkAIChatRateLimit(user);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(AI_CHAT_RATE_LIMIT.maxRequests - 1);
  });

  it("blocks after maxRequests inside the window with a retryAfter", () => {
    const user = `u-block-${Math.random()}`;
    for (let i = 0; i < AI_CHAT_RATE_LIMIT.maxRequests; i++) {
      expect(checkAIChatRateLimit(user).allowed).toBe(true);
    }
    const blocked = checkAIChatRateLimit(user);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetTime).toBeGreaterThan(Date.now());
  });

  it("unblocks once the sliding window passes (61s)", () => {
    const user = `u-window-${Math.random()}`;
    for (let i = 0; i < AI_CHAT_RATE_LIMIT.maxRequests; i++) {
      checkAIChatRateLimit(user);
    }
    expect(checkAIChatRateLimit(user).allowed).toBe(false);

    vi.advanceTimersByTime(AI_CHAT_RATE_LIMIT.windowMs + 1_000);
    expect(checkAIChatRateLimit(user).allowed).toBe(true);
  });

  it("slides per-request: old timestamps expire individually", () => {
    const user = `u-slide-${Math.random()}`;
    // 9 requests at t0
    for (let i = 0; i < AI_CHAT_RATE_LIMIT.maxRequests - 1; i++) {
      checkAIChatRateLimit(user);
    }
    // 30s later: 10th request allowed
    vi.advanceTimersByTime(30_000);
    expect(checkAIChatRateLimit(user).allowed).toBe(true);
    // 31s later again: the 9 t0 timestamps are now >60s old → allowed again
    vi.advanceTimersByTime(31_000);
    expect(checkAIChatRateLimit(user).allowed).toBe(true);
  });

  it("tracks users independently", () => {
    const a = `u-a-${Math.random()}`;
    const b = `u-b-${Math.random()}`;
    for (let i = 0; i < AI_CHAT_RATE_LIMIT.maxRequests; i++) {
      checkAIChatRateLimit(a);
    }
    expect(checkAIChatRateLimit(a).allowed).toBe(false);
    expect(checkAIChatRateLimit(b).allowed).toBe(true);
  });

  it("recordAIChatRequest is safe to call after an allowed check", () => {
    const user = `u-record-${Math.random()}`;
    expect(() => {
      checkAIChatRateLimit(user);
      recordAIChatRequest(user);
    }).not.toThrow();
  });
});
