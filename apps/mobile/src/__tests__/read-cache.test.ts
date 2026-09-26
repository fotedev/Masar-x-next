/**
 * LocalReadCache TTL tests (spec 018 C6/T073). AsyncStorage is a
 * native module — mocked with an in-memory Map; the unit under test is
 * the envelope round-trip + TTL arithmetic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getAllKeys: vi.fn(async () => [...store.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const key of keys) store.delete(key);
    }),
  },
}));

import {
  CACHE_VERSION,
  cacheClearAll,
  cacheGet,
  cacheInvalidate,
  cacheSet,
} from "../read-cache";

beforeEach(() => {
  store.clear();
  vi.useRealTimers();
});

describe("cacheSet / cacheGet", () => {
  it("round-trips a payload as a versioned envelope", async () => {
    await cacheSet("subjects:list", [{ id: "s1", name: "رياضيات" }]);
    const hit = await cacheGet<{ id: string; name: string }>("subjects:list");
    expect(hit?.payload).toEqual([{ id: "s1", name: "رياضيات" }]);
    expect(hit?.isStale).toBe(false);
    expect(typeof hit?.savedAt).toBe("string");
    const envelope = JSON.parse(
      store.get("masarx_read_cache_subjects:list") ?? "{}",
    ) as { version: number; ttlHours: number };
    expect(envelope.version).toBe(CACHE_VERSION);
    expect(envelope.ttlHours).toBe(168);
  });

  it("marks an entry stale past its TTL but still returns it", async () => {
    const t0 = new Date("2026-09-24T10:00:00Z").getTime();
    vi.useFakeTimers({ now: t0 });
    await cacheSet("summaries:all", { count: 3 }, 1);
    vi.setSystemTime(t0 + 2 * 60 * 60 * 1000); // 2h later, TTL was 1h
    const hit = await cacheGet<{ count: number }>("summaries:all");
    expect(hit?.isStale).toBe(true);
    expect(hit?.payload).toEqual({ count: 3 });
  });

  it("returns null for a missing key", async () => {
    await expect(cacheGet("nope")).resolves.toBeNull();
  });

  it("returns null for an unknown cache version", async () => {
    store.set(
      "masarx_read_cache_old",
      JSON.stringify({ version: 0, savedAt: new Date().toISOString(), ttlHours: 1, payload: {} }),
    );
    await expect(cacheGet("old")).resolves.toBeNull();
  });

  it("returns null on corrupt JSON instead of throwing", async () => {
    store.set("masarx_read_cache_broken", "{not json");
    await expect(cacheGet("broken")).resolves.toBeNull();
  });
});

describe("cacheInvalidate / cacheClearAll", () => {
  it("removes a single entry", async () => {
    await cacheSet("k1", 1);
    await cacheInvalidate("k1");
    await expect(cacheGet("k1")).resolves.toBeNull();
  });

  it("clears only masarx_read_cache_ keys", async () => {
    await cacheSet("a", 1);
    await cacheSet("b", 2);
    store.set("masarx_auth_session", "keep-me");
    await cacheClearAll();
    await expect(cacheGet("a")).resolves.toBeNull();
    await expect(cacheGet("b")).resolves.toBeNull();
    expect(store.get("masarx_auth_session")).toBe("keep-me");
  });
});
