/**
 * Chunking tests for the SecureStore text helper (spec 018 C6/T073).
 * expo-secure-store is a native module — mocked here with an in-memory
 * Map; the unit under test is the chunking/reassembly policy itself.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import {
  SECURE_STORE_KEY_PREFIX,
  secureStoreGetText,
  secureStoreRemoveText,
  secureStoreSetText,
} from "../secure-store-text";

beforeEach(() => {
  store.clear();
});

describe("secureStoreSetText / secureStoreGetText round-trip", () => {
  it("stores a short value as a single chunk", async () => {
    await secureStoreSetText("session", "hello");
    expect(store.get(`${SECURE_STORE_KEY_PREFIX}session`)).toBe(
      JSON.stringify({ v: 1, chunks: 1 }),
    );
    expect(store.get(`${SECURE_STORE_KEY_PREFIX}session__0`)).toBe("hello");
    await expect(secureStoreGetText("session")).resolves.toBe("hello");
  });

  it("round-trips a value larger than the 1600-char chunk size", async () => {
    // ~4000 chars => 3 chunks, exercising multi-chunk split + join order.
    const value = "x".repeat(4000);
    await secureStoreSetText("session", value);
    const header = JSON.parse(
      store.get(`${SECURE_STORE_KEY_PREFIX}session`) ?? "{}",
    ) as { chunks: number };
    expect(header.chunks).toBe(Math.ceil(4000 / 1600));
    await expect(secureStoreGetText("session")).resolves.toBe(value);
  });

  it("round-trips multibyte content (Arabic + emoji) without corruption", async () => {
    // Chunking slices by UTF-16 code units; this asserts the split/join
    // is byte-faithful for surrogate pairs and Arabic text.
    const value = "مرحبا".repeat(600) + "🎓".repeat(200);
    await secureStoreSetText("session", value);
    await expect(secureStoreGetText("session")).resolves.toBe(value);
  });

  it("overwrites a larger previous value and cleans up stale chunks", async () => {
    await secureStoreSetText("session", "a".repeat(5000)); // 4 chunks
    await secureStoreSetText("session", "b".repeat(100)); // 1 chunk
    // Stale chunks 1..3 must be gone; reassembly reads only header count.
    expect(store.has(`${SECURE_STORE_KEY_PREFIX}session__1`)).toBe(false);
    await expect(secureStoreGetText("session")).resolves.toBe("b".repeat(100));
  });
});

describe("secureStoreGetText failure modes", () => {
  it("returns null for a missing key", async () => {
    await expect(secureStoreGetText("missing")).resolves.toBeNull();
  });

  it("returns null on a corrupt header (re-auth fallback)", async () => {
    store.set(`${SECURE_STORE_KEY_PREFIX}session`, "not-json");
    await expect(secureStoreGetText("session")).resolves.toBeNull();
  });
});

describe("secureStoreRemoveText", () => {
  it("removes the header and all chunks", async () => {
    await secureStoreSetText("session", "c".repeat(3400)); // 3 chunks
    await secureStoreRemoveText("session");
    expect(store.has(`${SECURE_STORE_KEY_PREFIX}session`)).toBe(false);
    expect(store.has(`${SECURE_STORE_KEY_PREFIX}session__0`)).toBe(false);
    expect(store.has(`${SECURE_STORE_KEY_PREFIX}session__2`)).toBe(false);
  });
});
