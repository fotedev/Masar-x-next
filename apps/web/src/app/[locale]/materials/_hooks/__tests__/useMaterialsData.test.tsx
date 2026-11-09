import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

// Mutable per-test auth + academic state (vi.mock factories are hoisted).
const { authState, academicState, semesterState } = await vi.hoisted(() => ({
  authState: { user: null as { id: string } | null, isAdmin: false },
  academicState: {
    academic: {
      level: null as number | null,
      semester: null as number | null,
      department_id: null as string | null,
    },
    loading: false,
  },
  semesterState: { effectiveSemester: 1, guestSemester: null },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUserAcademic", () => ({ useUserAcademic: () => academicState }));
vi.mock("@/hooks/useEffectiveSemester", () => ({
  useEffectiveSemester: () => semesterState,
}));

import { useMaterialsData } from "../useMaterialsData";
import { renderHookWithProviders } from "@/test/utils/render";

beforeEach(() => {
  authState.user = null;
  authState.isAdmin = false;
  academicState.academic = { level: null, semester: null, department_id: null };
  academicState.loading = false;
  semesterState.effectiveSemester = 1;
});

// Manifest shape (spec 033, live data): 20 subjects = 7 crawled Y2-S1 +
// 13 Y1-S1 stubs, every row carrying non-null level/semester.
describe("useMaterialsData — profile-driven manifest scoping (owner decision 2026-11-05)", () => {
  it("guest resolves to level 1 + effective semester (the 13 Y1-S1 stubs)", async () => {
    const { result } = renderHookWithProviders(() => useMaterialsData());
    await waitFor(() => expect(result.current.filteredSubjects.length).toBe(13));
    expect(
      result.current.filteredSubjects.every(
        (s) => s.level === 1 && s.semester === 1,
      ),
    ).toBe(true);
  });

  it("level-2 semester-1 student sees only the 7 crawled Y2-S1 subjects", async () => {
    authState.user = { id: "u1" };
    academicState.academic = { level: 2, semester: 1, department_id: null };
    const { result } = renderHookWithProviders(() => useMaterialsData());
    await waitFor(() => expect(result.current.filteredSubjects.length).toBe(7));
    expect(
      result.current.filteredSubjects.every(
        (s) => s.level === 2 && s.semester === 1,
      ),
    ).toBe(true);
  });

  it("semester filter follows the profile semester (level 2, semester 2 → empty)", () => {
    authState.user = { id: "u1" };
    academicState.academic = { level: 2, semester: 2, department_id: null };
    semesterState.effectiveSemester = 2;
    const { result } = renderHookWithProviders(() => useMaterialsData());
    expect(result.current.filteredSubjects).toEqual([]);
  });

  it("admins browse the whole manifest (no scoping)", () => {
    authState.user = { id: "admin-1" };
    authState.isAdmin = true;
    const { result } = renderHookWithProviders(() => useMaterialsData());
    expect(result.current.filteredSubjects.length).toBe(20);
  });
});
