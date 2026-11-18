// Spec 049 — useConversations unit tests (paged conversation list, read-only).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";

const { chain } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock() };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));

import { useConversations } from "../useConversations";

const authUser = { id: "u-1" } as unknown as User;
const MODE_A = "cs_assistant";

const mkConv = (id: string, updatedAt: string) => ({
  id,
  user_id: "u-1",
  mode: MODE_A,
  title: `t-${id}`,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: updatedAt,
});

// Page rows newest-first, as the DB orders them (updated_at desc).
const convRows = (n: number, base: number) =>
  Array.from({ length: n }, (_, i) => mkConv(`c${base + i}`, new Date(2026, 0, 1, 0, 0, base + i).toISOString())).reverse();

beforeEach(() => {
  vi.clearAllMocks();
  chain.calls.length = 0;
  // Same cross-test leak guard as useAiChat.test.tsx (spec 049).
  chain.resetResponses();
  chain.respondWith({ data: [], error: null }, { table: "conversations", method: "range" });
});

describe("useConversations", () => {
  it("is empty and fetch-free for guests", async () => {
    const { result } = renderHook(() => useConversations(null, MODE_A));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(chain.calls).toHaveLength(0);
  });

  it("loads the first page scoped by user + mode, newest first", async () => {
    chain.respondWith(
      { data: convRows(2, 0), error: null },
      { table: "conversations", method: "range" },
    );
    const { result } = renderHook(() => useConversations(authUser, MODE_A));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));
    // DB order (updated_at desc) is preserved as-is — newest first.
    expect(result.current.conversations[0].id).toBe("c1");
    expect(result.current.hasMore).toBe(false);

    const from = chain.calls.find((c) => c.table === "conversations" && c.method === "eq");
    expect(from).toBeDefined();
    const eqs = chain.calls.filter((c) => c.table === "conversations" && c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["user_id", "u-1"]);
    expect(eqs).toContainEqual(["mode", MODE_A]);
    const order = chain.calls.find((c) => c.table === "conversations" && c.method === "order");
    expect(order!.args).toEqual(["updated_at", { ascending: false }]);
    const range = chain.calls.find((c) => c.table === "conversations" && c.method === "range");
    expect(range!.args).toEqual([0, 29]);
  });

  it("loadMore appends the next page and a short page terminates hasMore", async () => {
    chain.respondWith(
      { data: convRows(30, 0), error: null },
      { table: "conversations", method: "range" },
    );
    const { result } = renderHook(() => useConversations(authUser, MODE_A));
    await waitFor(() => expect(result.current.conversations).toHaveLength(30));
    expect(result.current.hasMore).toBe(true);

    // Next page: only 2 rows → short page → hasMore false.
    chain.respondWith(
      { data: convRows(2, 100), error: null },
      { table: "conversations", method: "range" },
    );
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.conversations).toHaveLength(32);
    expect(result.current.conversations[30].id).toBe("c101");
    expect(result.current.hasMore).toBe(false);
  });

  it("refresh resets to the first page", async () => {
    chain.respondWith(
      { data: convRows(30, 0), error: null },
      { table: "conversations", method: "range" },
    );
    const { result } = renderHook(() => useConversations(authUser, MODE_A));
    await waitFor(() => expect(result.current.conversations).toHaveLength(30));

    chain.respondWith(
      { data: convRows(3, 200), error: null },
      { table: "conversations", method: "range" },
    );
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.conversations).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("degrades to an empty list on query error", async () => {
    chain.respondWith(
      { data: null, error: { message: "boom" } },
      { table: "conversations", method: "range" },
    );
    const { result } = renderHook(() => useConversations(authUser, MODE_A));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("refetches when the mode filter changes", async () => {
    const { result, rerender } = renderHook(
      ({ m }: { m: string }) => useConversations(authUser, m as typeof MODE_A),
      { initialProps: { m: MODE_A } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const selectsBefore = chain.calls.filter((c) => c.table === "conversations").length;

    rerender({ m: "student_agent" });
    await waitFor(() =>
      expect(chain.calls.filter((c) => c.table === "conversations").length).toBeGreaterThan(selectsBefore),
    );
    const eqs = chain.calls.filter((c) => c.table === "conversations" && c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["mode", "student_agent"]);
  });

  it("loadMore is a no-op without hasMore", async () => {
    const { result } = renderHook(() => useConversations(authUser, MODE_A));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = chain.calls.length;

    await act(async () => {
      await result.current.loadMore();
    });

    expect(chain.calls.length).toBe(callsBefore);
  });
});
