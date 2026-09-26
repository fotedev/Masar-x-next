import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

// Mutable per-test auth + academic state (vi.mock factories are hoisted).
const { authState, academicState, semesterState, chain } = await vi.hoisted(
  async () => {
    const { createSupabaseMock } = await import("@/test/mocks/supabase");
    return {
      authState: { user: null as { id: string } | null, isAdmin: false },
      academicState: {
        academic: { level: 1, semester: 1, department_id: null },
        loading: false,
      },
      semesterState: { effectiveSemester: 1, guestSemester: null },
      chain: createSupabaseMock(),
    };
  },
);

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUserAcademic", () => ({ useUserAcademic: () => academicState }));
vi.mock("@/hooks/useEffectiveSemester", () => ({
  useEffectiveSemester: () => semesterState,
}));

import { useSubjects } from "../useSubjects";
import { renderHookWithProviders } from "@/test/utils/render";

beforeEach(() => {
  chain.calls.length = 0;
  authState.user = { id: "u1" };
  authState.isAdmin = false;
  academicState.loading = false;
});

describe("useSubjects — shared behavior (survives the TRW refactor merge)", () => {
  it("orders subjects by name ascending", async () => {
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() =>
      expect(chain.calls.some((c) => c.method === "order")).toBe(true),
    );
    expect(chain.calls.find((c) => c.method === "order")!.args).toEqual([
      "name",
      { ascending: true },
    ]);
  });

  it("scopes non-admin queries to the student's level and semester", async () => {
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects({ level: 2, semester: 3 }));
    await waitFor(() =>
      expect(chain.calls.filter((c) => c.method === "or").length).toBeGreaterThan(1),
    );
    const orArgs = chain.calls
      .filter((c) => c.method === "or")
      .map((c) => String(c.args[0]));
    expect(orArgs).toContain("level.eq.2,level.is.null");
    expect(orArgs).toContain("semester.eq.3,semester.is.null");
  });

  it("anonymous users additionally filter show_on_home=true", async () => {
    authState.user = null;
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() =>
      expect(chain.calls.some((c) => c.method === "eq")).toBe(true),
    );
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual([
      "show_on_home",
      true,
    ]);
  });

  it("admins skip level/semester scoping entirely", async () => {
    authState.user = { id: "admin-1" };
    authState.isAdmin = true;
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(chain.calls.some((c) => c.method === "order")).toBe(true));
    const orArgs = chain.calls.filter((c) => c.method === "or");
    expect(orArgs).toEqual([]); // no scoping clauses for admins
  });

  it("deleteSubject removes by id", async () => {
    chain.respondWith({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.deleteSubject("s-1");
    const del = chain.calls.find((c) => c.method === "delete");
    expect(del).toBeDefined();
    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual(["id", "s-1"]);
  });

  it("createSubject inserts and returns the new row", async () => {
    // Scoped: the catalog query (ends .or) sees []; the insert chain (.single) sees the row.
    chain.respondWith({ data: [], error: null }, { table: "subjects", method: "or" });
    chain.respondWith({ data: { id: "new-1" }, error: null }, { table: "subjects", method: "single" });
    const { result } = renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const created = await result.current.createSubject({ name: "رياضيات" });
    expect(created.id).toBe("new-1");
    const insert = chain.calls.find((c) => c.table === "subjects" && c.method === "insert");
    expect(insert).toBeDefined();
  });

  it("updateSubject applies partial updates by id", async () => {
    chain.respondWith({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.updateSubject("s-1", { name: "فيزياء" });
    const update = chain.calls.find((c) => c.method === "update");
    expect((update!.args[0] as Record<string, unknown>).name).toBe("فيزياء");
  });

  it("swallows query errors and returns [] (logger path)", async () => {
    chain.respondWith({ data: null, error: { message: "boom" } });
    const { result } = renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subjects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// LEGACY CONTRACT — the CURRENT shipping behavior includes is_academic
// filtering. These assertions LOCK today's behavior so any accidental change
// (in either direction) is deliberate.
//
// @todo: remove after TRW refactor merge (spec 015 contracts A/B/C supersede
// this block — refactor/decouple-trw-subjects drops is_academic entirely).
// ---------------------------------------------------------------------------
describe("LEGACY is_academic behavior — @todo: remove after TRW refactor merge (spec 015)", () => {
  it("non-admin academic view adds is_academic.eq.true/is.null clauses", async () => {
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() =>
      expect(chain.calls.filter((c) => c.method === "or").length).toBeGreaterThan(2),
    );
    const orArgs = chain.calls
      .filter((c) => c.method === "or")
      .map((c) => String(c.args[0]));
    expect(orArgs[0]).toBe("is_academic.eq.true,is_academic.is.null");
  });

  it("non-admin is_academic=false view adds is_academic.eq.false/is.null", async () => {
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects({ is_academic: false }));
    await waitFor(() =>
      expect(chain.calls.filter((c) => c.method === "or").length).toBeGreaterThan(2),
    );
    const orArgs = chain.calls
      .filter((c) => c.method === "or")
      .map((c) => String(c.args[0]));
    expect(orArgs[0]).toBe("is_academic.eq.false,is_academic.is.null");
  });

  it("the select list includes the is_academic column", async () => {
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() =>
      expect(chain.calls.some((c) => c.method === "select")).toBe(true),
    );
    const select = String(chain.calls.find((c) => c.method === "select")!.args[0]);
    expect(select).toContain("is_academic");
  });

  it("admin queries carry NO is_academic clauses", async () => {
    authState.user = { id: "admin-1" };
    authState.isAdmin = true;
    chain.respondWith({ data: [], error: null });
    renderHookWithProviders(() => useSubjects());
    await waitFor(() => expect(chain.calls.some((c) => c.method === "order")).toBe(true));
    // Contract: admins get no is_academic FILTER clauses (the select column
    // list may still mention it — filtering is what Phase 2 removes).
    const orArgs = chain.calls
      .filter((c) => c.method === "or")
      .map((c) => String(c.args[0]));
    expect(orArgs.some((a) => a.includes("is_academic"))).toBe(false);
  });
});
