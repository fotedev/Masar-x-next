/**
 * Chat-history storage tests (spec 019 C5/T093) — lock the cap, the
 * pending-bubble exclusion, the clear semantics, and the corrupt-store
 * degradation. AsyncStorage mocked with an in-memory Map (same pattern
 * as read-cache.test.ts).
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
  },
}));

import {
  CHAT_HISTORY_CAP,
  CHAT_HISTORY_KEY,
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
  toPersisted,
  type PersistedChatMessage,
} from "../chat-history";

const msg = (id: string, over: Partial<PersistedChatMessage> = {}) => ({
  id,
  role: "user" as const,
  text: `text-${id}`,
  ...over,
});

beforeEach(() => {
  store.clear();
});

describe("toPersisted", () => {
  it("excludes pending spinner bubbles", () => {
    const out = toPersisted([
      msg("u1"),
      { id: "a1", role: "assistant", text: "", pending: true },
      msg("a2", { role: "assistant", text: "answer" }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["u1", "a2"]);
  });

  it("caps at 100 dropping the oldest", () => {
    const many = Array.from({ length: CHAT_HISTORY_CAP + 5 }, (_, i) => msg(`m${i + 1}`));
    const out = toPersisted(many);
    expect(out).toHaveLength(CHAT_HISTORY_CAP);
    expect(out[0].id).toBe("m6");
    expect(out.at(-1)?.id).toBe(`m${CHAT_HISTORY_CAP + 5}`);
  });

  it("keeps failed + retryText so the retry affordance survives a restart", () => {
    const out = toPersisted([msg("a1", { role: "assistant", failed: true, retryText: "hi" })]);
    expect(out[0]).toEqual({ id: "a1", role: "assistant", text: "text-a1", failed: true, retryText: "hi" });
  });
});

describe("save/load round-trip", () => {
  it("round-trips messages under the isolated key", async () => {
    await saveChatHistory([
      msg("u1"),
      msg("a1", { role: "assistant", text: "مرحبا بك" }),
      { id: "a2", role: "assistant", text: "", pending: true },
    ]);
    expect(store.has(CHAT_HISTORY_KEY)).toBe(true);
    const loaded = await loadChatHistory();
    expect(loaded.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(loaded[1].text).toBe("مرحبا بك");
  });

  it("returns [] for a missing key", async () => {
    await expect(loadChatHistory()).resolves.toEqual([]);
  });

  it("degrades to [] on corrupt JSON", async () => {
    store.set(CHAT_HISTORY_KEY, "{not json");
    await expect(loadChatHistory()).resolves.toEqual([]);
  });

  it("degrades to [] on a non-array payload", async () => {
    store.set(CHAT_HISTORY_KEY, JSON.stringify({ id: "x" }));
    await expect(loadChatHistory()).resolves.toEqual([]);
  });

  it("filters out malformed entries instead of throwing", async () => {
    store.set(
      CHAT_HISTORY_KEY,
      JSON.stringify([msg("ok"), { nope: true }, null, msg("ok2")]),
    );
    const loaded = await loadChatHistory();
    expect(loaded.map((m) => m.id)).toEqual(["ok", "ok2"]);
  });
});

describe("clearChatHistory", () => {
  it("removes the key entirely (deletion exclusive to clear)", async () => {
    await saveChatHistory([msg("u1")]);
    await clearChatHistory();
    expect(store.has(CHAT_HISTORY_KEY)).toBe(false);
    await expect(loadChatHistory()).resolves.toEqual([]);
  });
});
