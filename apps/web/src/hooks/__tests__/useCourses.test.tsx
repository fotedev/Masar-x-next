import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

const { chain } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock() };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useCourses } from "../useCourses";
import { renderHookWithProviders } from "@/test/utils/render";

const RAW_COURSES = [
  {
    id: "c1",
    title: "Anatomy",
    description: "d",
    instructor_id: "i1",
    price: 0,
    is_published: true,
    is_academic: true,
    created_at: "2025-01-01T00:00:00Z",
    profiles: { display_name: "Dr. Salma", full_name: null, username: "salma" },
    enrollments: [{ status: "active" }, { status: "cancelled" }],
    reviews: [{ rating: 5 }, { rating: 3 }],
  },
];

beforeEach(() => {
  chain.calls.length = 0;
});

describe("useCourses", () => {
  it("fetches courses with join shape and computes aggregates", async () => {
    chain.respondWith({ data: RAW_COURSES, error: null }, { table: "courses" });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.courses).toHaveLength(1);
    const course = result.current.courses[0];
    expect(course.instructor_name).toBe("Dr. Salma");
    expect(course.enrollments_count).toBe(1); // only 'active'
    expect(course.total_students).toBe(1);
    expect(course.average_rating).toBe(4); // (5+3)/2
  });

  it("falls back through the instructor name precedence chain", async () => {
    const noDisplay = {
      ...RAW_COURSES[0],
      profiles: { display_name: null, full_name: "Dr. Full", username: "u" },
    };
    chain.respondWith({ data: [noDisplay], error: null }, { table: "courses" });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.courses).toHaveLength(1));
    expect(result.current.courses[0].instructor_name).toBe("Dr. Full");
  });

  it("orders by created_at descending", async () => {
    chain.respondWith({ data: [], error: null }, { table: "courses" });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chain.calls.find((c) => c.method === "order")!.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("swallows fetch errors into an empty list", async () => {
    chain.respondWith({ data: null, error: { message: "x" } }, { table: "courses" });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courses).toEqual([]);
  });

  it("deleteCourse removes by id via the mutation", async () => {
    chain.respondWith({ data: [], error: null }, { table: "courses" });
    chain.respondWith({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.deleteCourse("c-9");
    const del = chain.calls.find((c) => c.table === "courses" && c.method === "delete");
    expect(del).toBeDefined();
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual(["id", "c-9"]);
  });

  it("togglePublish flips the is_published flag", async () => {
    chain.respondWith({ data: [], error: null }, { table: "courses" });
    chain.respondWith({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useCourses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.togglePublish("c-1", false); // current=false → publish=true
    const update = chain.calls.find((c) => c.method === "update");
    expect((update!.args[0] as Record<string, unknown>).is_published).toBe(true);
  });
});
