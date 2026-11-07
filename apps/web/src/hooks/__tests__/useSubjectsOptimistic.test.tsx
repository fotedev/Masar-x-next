// Spec 040 Wave 3 — optimistic mutation contracts of useSubjects (spec 034
// refactor). For every mutation: the onMutate snapshot is applied to the
// subjects cache optimistically mid-flight, and an error restores it.
// Reuses the useSubjects.test.tsx mock style; the chain mock accepts a
// Promise as a respondWith result, which gates the DB write so the
// mid-flight cache state is observable deterministically.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

const { authState, academicState, semesterState, chain } = await vi.hoisted(
  async () => {
    const { createSupabaseMock } = await import("@/test/mocks/supabase");
    return {
      authState: { user: { id: "u1" } as { id: string } | null, isAdmin: false },
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

const ROWS = [
  { id: "s-1", name: "رياضيات", show_on_home: true },
  { id: "s-2", name: "فيزياء", show_on_home: true },
];

// Signed-in non-admin query ends in .or → matches the "or" method.
function seedQuery() {
  chain.respondWith({ data: ROWS, error: null }, { table: "subjects", method: "or" });
}

type CacheRow = (typeof ROWS)[number];

function makeHarness() {
  const utils = renderHookWithProviders(() => useSubjects());
  const cacheData = () =>
    utils.queryClient
      .getQueryCache()
      .find({ queryKey: ["subjects"], exact: false })?.state
      .data as CacheRow[] | undefined;
  return { ...utils, cacheData };
}

async function renderSettled() {
  seedQuery();
  const utils = makeHarness();
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  expect(utils.cacheData()).toEqual(ROWS);
  return utils;
}

beforeEach(() => {
  chain.calls.length = 0;
  authState.user = { id: "u1" };
  authState.isAdmin = false;
  academicState.academic = { level: 1, semester: 1, department_id: null };
  academicState.loading = false;
});

describe("updateSubjectVisibility optimistic contract", () => {
  it("applies show_on_home optimistically mid-flight, then reflects success", async () => {
    const utils = await renderSettled();

    let release!: (v: unknown) => void;
    chain.respondWith(new Promise((res) => { release = res; }), {
      table: "subjects",
      method: "eq",
    });

    const mutation = utils.result.current.updateSubjectVisibility("s-1", false);
    await waitFor(() => expect(utils.cacheData()![0].show_on_home).toBe(false));

    release({ data: null, error: null });
    await mutation;
    expect(utils.cacheData()![0].show_on_home).toBe(false);
  });

  it("restores the onMutate snapshot when the DB write fails", async () => {
    const utils = await renderSettled();

    chain.respondWith(
      { data: null, error: { message: "rls denied" } },
      { table: "subjects", method: "eq" },
    );

    await expect(
      utils.result.current.updateSubjectVisibility("s-1", false),
    ).rejects.toBeTruthy();

    expect(utils.cacheData()).toEqual(ROWS);
  });
});

describe("updateSubject optimistic contract", () => {
  it("applies the partial update optimistically mid-flight", async () => {
    const utils = await renderSettled();

    let release!: (v: unknown) => void;
    chain.respondWith(new Promise((res) => { release = res; }), {
      table: "subjects",
      method: "eq",
    });

    const mutation = utils.result.current.updateSubject("s-1", {
      name: "جبر",
    });
    await waitFor(() => expect(utils.cacheData()![0].name).toBe("جبر"));
    // Sibling rows are untouched by the partial update.
    expect(utils.cacheData()![1]).toEqual(ROWS[1]);

    release({ data: null, error: null });
    await mutation;
  });

  it("restores the onMutate snapshot when the DB write fails", async () => {
    const utils = await renderSettled();

    chain.respondWith(
      { data: null, error: { message: "rls denied" } },
      { table: "subjects", method: "eq" },
    );

    await expect(
      utils.result.current.updateSubject("s-1", { name: "جبر" }),
    ).rejects.toBeTruthy();

    expect(utils.cacheData()).toEqual(ROWS);
  });
});

describe("createSubject optimistic contract", () => {
  it("prepends an isOptimistic row mid-flight", async () => {
    const utils = await renderSettled();

    let release!: (v: unknown) => void;
    chain.respondWith(new Promise((res) => { release = res; }), {
      table: "subjects",
      method: "single",
    });

    const mutation = utils.result.current.createSubject({
      name: "كيمياء",
      level: 1,
      semester: 2,
    });
    await waitFor(() =>
      expect(utils.cacheData()![0].isOptimistic).toBe(true),
    );
    expect(utils.cacheData()![0]).toMatchObject({
      name: "كيمياء",
      level: 1,
      semester: 2,
      status: "approved",
      show_on_home: true,
    });
    expect(String(utils.cacheData()![0].id)).toMatch(/^optimistic-\d+$/);
    // Prepend: original rows follow untouched.
    expect(utils.cacheData()!.slice(1)).toEqual(ROWS);

    release({ data: { id: "new-1" }, error: null });
    await mutation;
  });

  it("removes the optimistic row when the insert fails", async () => {
    const utils = await renderSettled();

    chain.respondWith(
      { data: null, error: { message: "insert denied" } },
      { table: "subjects", method: "single" },
    );

    await expect(
      utils.result.current.createSubject({ name: "كيمياء" }),
    ).rejects.toBeTruthy();

    expect(utils.cacheData()).toEqual(ROWS);
  });
});

describe("deleteSubject optimistic contract", () => {
  it("filters the row out of the cache mid-flight", async () => {
    const utils = await renderSettled();

    let release!: (v: unknown) => void;
    chain.respondWith(new Promise((res) => { release = res; }), {
      table: "subjects",
      method: "eq",
    });

    const mutation = utils.result.current.deleteSubject("s-1");
    await waitFor(() =>
      expect(utils.cacheData()!.map((r) => r.id)).toEqual(["s-2"]),
    );

    release({ data: null, error: null });
    await mutation;
  });

  it("restores the deleted row when the DB write fails", async () => {
    const utils = await renderSettled();

    chain.respondWith(
      { data: null, error: { message: "delete denied" } },
      { table: "subjects", method: "eq" },
    );

    await expect(utils.result.current.deleteSubject("s-1")).rejects.toBeTruthy();

    expect(utils.cacheData()).toEqual(ROWS);
  });
});
