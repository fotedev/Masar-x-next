import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

// TRW hooks build their client via createClient() per call — mock the module
// and hand back the shared chain recorder's client.
const { chain, authUser } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock(), authUser: { id: "user-1" } };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => chain.supabase,
}));

import useTRWMembership from "../trw/useTRWMembership";
import useTRWCategories from "../trw/useTRWCategories";
import { renderHookWithProviders } from "@/test/utils/render";

beforeEach(() => {
  chain.calls.length = 0;
  vi.mocked(chain.supabase.auth.getUser).mockResolvedValue({
    data: { user: authUser },
    error: null,
  } as never);
});

describe("useTRWMembership", () => {
  it("returns null without querying memberships for anonymous users", async () => {
    vi.mocked(chain.supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
    const { result } = renderHookWithProviders(() => useTRWMembership());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(chain.calls.filter((c) => c.table === "trw_memberships")).toEqual([]);
  });

  it("queries active memberships with plan join for signed-in users", async () => {
    const membership = { id: "m1", plan: { id: "p1" } };
    chain.respondWith({ data: membership, error: null }, { table: "trw_memberships" });

    const { result } = renderHookWithProviders(() => useTRWMembership());
    await waitFor(() => expect(result.current.data).toEqual(membership));

    const eq = chain.calls.find((c) => c.table === "trw_memberships" && c.method === "eq");
    expect(eq!.args).toEqual(["user_id", "user-1"]);
    const is = chain.calls.find((c) => c.method === "is");
    expect(is!.args).toEqual(["revoked_at", null]);
    const or = chain.calls.find((c) => c.method === "or");
    expect(String(or!.args[0])).toContain("expires_at");
  });

  it("surfaces PostgREST errors as query errors", async () => {
    chain.respondWith(
      { data: null, error: { message: "rls denied" } },
      { table: "trw_memberships" },
    );
    const { result } = renderHookWithProviders(() => useTRWMembership());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTRWCategories", () => {
  it("reads only published categories ordered by sort_order", async () => {
    chain.respondWith(
      { data: [{ id: "c1" }], error: null },
      { table: "trw_categories" },
    );
    const { result } = renderHookWithProviders(() => useTRWCategories());
    await waitFor(() => expect(result.current.data).toEqual([{ id: "c1" }]));

    const from = chain.calls.find((c) => c.table === "trw_categories");
    expect(from).toBeDefined();
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual(["is_published", true]);
    expect(chain.calls.find((c) => c.method === "order")!.args).toEqual([
      "sort_order",
      { ascending: true },
    ]);
    // Contract: categories come from trw_categories, never from subjects.
    expect(chain.calls.some((c) => c.table === "subjects")).toBe(false);
  });
});
