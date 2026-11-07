// Spec 040 Wave 3 — useRedeemAccessCode + TRW sibling contracts.
// Follows the useTRW.test.tsx pattern: mock '@/lib/supabase/client'
// createClient → the shared chain-recording supabase.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

const { chain, authUser } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock(), authUser: { id: "user-1" } };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => chain.supabase,
}));

import useRedeemAccessCode from "../trw/useRedeemAccessCode";
import useTRWCourses from "../trw/useTRWCourses";
import useTRWCourseDetails from "../trw/useTRWCourseDetails";
import useTRWProgress from "../trw/useTRWProgress";
import { renderHookWithProviders } from "@/test/utils/render";

beforeEach(() => {
  chain.calls.length = 0;
  vi.mocked(chain.supabase.auth.getUser).mockResolvedValue({
    data: { user: authUser },
    error: null,
  } as never);
});

describe("useRedeemAccessCode", () => {
  it("calls the trw_redeem_access_code RPC with the code and returns its data", async () => {
    chain.respondWith(
      { data: { ok: true }, error: null },
      { table: "rpc:trw_redeem_access_code" },
    );
    const { result } = renderHookWithProviders(() => useRedeemAccessCode());

    const data = await result.current.mutateAsync("CODE-1");

    expect(data).toEqual({ ok: true });
    const rpc = chain.calls.find(
      (c) => c.table === "rpc:trw_redeem_access_code" && c.method === "rpc",
    );
    expect(rpc).toBeDefined();
    expect(rpc!.args).toEqual([{ p_code: "CODE-1" }]);
  });

  it("throws the PostgREST error so the mutation enters the error state", async () => {
    chain.respondWith(
      { data: null, error: { message: "invalid or already used code" } },
      { table: "rpc:trw_redeem_access_code" },
    );
    const { result } = renderHookWithProviders(() => useRedeemAccessCode());

    await expect(result.current.mutateAsync("BAD")).rejects.toEqual({
      message: "invalid or already used code",
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("success invalidates the trw-membership query key", async () => {
    chain.respondWith(
      { data: { ok: true }, error: null },
      { table: "rpc:trw_redeem_access_code" },
    );
    const { result, queryClient } = renderHookWithProviders(() =>
      useRedeemAccessCode(),
    );
    queryClient.setQueryData(["trw-membership"], { plan: "p1" });
    expect(queryClient.getQueryState(["trw-membership"])?.isInvalidated).toBe(
      false,
    );

    await result.current.mutateAsync("CODE-1");

    expect(queryClient.getQueryState(["trw-membership"])?.isInvalidated).toBe(
      true,
    );
  });
});

describe("useTRWCourses (two-step slug → id chain)", () => {
  it("is disabled without a category slug (no fetch)", () => {
    const { result } = renderHookWithProviders(() => useTRWCourses(""));
    expect(result.current.fetchStatus).toBe("idle");
    expect(chain.calls).toEqual([]);
  });

  it("resolves the category id first, then fetches its published courses", async () => {
    const courses = [{ id: "co-1", title: "Course" }];
    chain.respondWith(
      { data: { id: "cat-1" }, error: null },
      { table: "trw_categories", method: "single" },
    );
    chain.respondWith(
      { data: courses, error: null },
      { table: "trw_courses", method: "order" },
    );

    const { result } = renderHookWithProviders(() => useTRWCourses("slug-a"));
    await waitFor(() => expect(result.current.data).toEqual(courses));

    // Step 1: category id by slug.
    const catEq = chain.calls.find(
      (c) => c.table === "trw_categories" && c.method === "eq",
    );
    expect(catEq!.args).toEqual(["slug", "slug-a"]);
    expect(chain.calls.some((c) => c.table === "trw_categories" && c.method === "single")).toBe(true);

    // Step 2: courses scoped to that category, published only, ordered.
    const eqs = chain.calls
      .filter((c) => c.table === "trw_courses" && c.method === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["category_id", "cat-1"]);
    expect(eqs).toContainEqual(["is_published", true]);
    expect(
      chain.calls.find((c) => c.table === "trw_courses" && c.method === "order")!.args,
    ).toEqual(["sort_order", { ascending: true }]);
  });

  it("surfaces a category lookup failure as a query error", async () => {
    chain.respondWith(
      { data: null, error: { message: "no such category" } },
      { table: "trw_categories", method: "single" },
    );
    const { result } = renderHookWithProviders(() => useTRWCourses("slug-a"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "no such category" });
  });
});

describe("useTRWCourseDetails (nested modules → materials)", () => {
  it("fetches the course with nested modules and materials by slug", async () => {
    const course = {
      id: "c-1",
      slug: "course-1",
      modules: [
        { id: "m-1", materials: [{ id: "mt-1", title: "Material" }] },
      ],
    };
    chain.respondWith(
      { data: course, error: null },
      { table: "trw_courses", method: "single" },
    );

    const { result } = renderHookWithProviders(() =>
      useTRWCourseDetails("course-1"),
    );
    await waitFor(() => expect(result.current.data).toEqual(course));

    expect(chain.calls.find((c) => c.table === "trw_courses" && c.method === "eq")!.args).toEqual([
      "slug",
      "course-1",
    ]);
    const select = chain.calls.find(
      (c) => c.table === "trw_courses" && c.method === "select",
    )!.args[0] as string;
    expect(select).toContain("modules:trw_modules(");
    expect(select).toContain("materials:trw_materials(");
    expect(chain.calls.some((c) => c.table === "trw_courses" && c.method === "single")).toBe(true);
  });
});

describe("useTRWProgress (auth gate)", () => {
  it("returns [] without querying progress for anonymous users", async () => {
    vi.mocked(chain.supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const { result } = renderHookWithProviders(() => useTRWProgress());
    await waitFor(() => expect(result.current.data).toEqual([]));

    expect(chain.calls.some((c) => c.table === "trw_user_progress")).toBe(false);
  });

  it("fetches the signed-in user's completed material ids", async () => {
    const progress = [{ material_id: "mt-1", completed_at: "2026-01-01" }];
    chain.respondWith(
      { data: progress, error: null },
      { table: "trw_user_progress" },
    );

    const { result } = renderHookWithProviders(() => useTRWProgress());
    await waitFor(() => expect(result.current.data).toEqual(progress));

    expect(
      chain.calls.find((c) => c.table === "trw_user_progress" && c.method === "eq")!.args,
    ).toEqual(["user_id", "user-1"]);
    const select = chain.calls.find(
      (c) => c.table === "trw_user_progress" && c.method === "select",
    )!.args[0] as string;
    expect(select).toBe("material_id, completed_at");
  });
});
