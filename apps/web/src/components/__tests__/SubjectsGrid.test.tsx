import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { subjectsState } = vi.hoisted(() => ({
  subjectsState: {
    subjects: [] as Array<{ id: string; name: string; name_en?: string | null; show_on_home: boolean; isOptimistic?: boolean }>,
    loading: true,
  },
}));

vi.mock("@/hooks/useSubjects", () => ({
  useSubjects: (params: { is_academic?: boolean }) => {
    (subjectsState as { lastParams?: unknown }).lastParams = params;
    return subjectsState;
  },
}));
vi.mock("next-intl", () => ({
  useLocale: () => "ar",
  useTranslations:
    (ns: string) =>
    (key: string) =>
      `${ns}.${key}`,
}));

import { SubjectsGrid } from "../SubjectsGrid";

beforeEach(() => {
  subjectsState.subjects = [];
  subjectsState.loading = true;
});

describe("SubjectsGrid", () => {
  it("renders 8 skeletons while loading", () => {
    render(<SubjectsGrid />);
    expect(screen.queryAllByRole("button").length).toBe(0);
    expect(document.querySelectorAll(".modern-card").length).toBe(8);
  });

  it("renders one card per subject with locale-aware names", async () => {
    subjectsState.loading = false;
    subjectsState.subjects = [
      { id: "s1", name: "رياضيات", name_en: "Math", show_on_home: true },
      { id: "s2", name: "فيزياء", name_en: "Physics", show_on_home: true },
    ];
    render(<SubjectsGrid />);
    await waitFor(() => expect(screen.getByRole("button", { name: /رياضيات/ })).toBeDefined());
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("showOnlyOnHome filters out non-featured subjects", () => {
    subjectsState.loading = false;
    subjectsState.subjects = [
      { id: "s1", name: "A", show_on_home: true },
      { id: "s2", name: "B", show_on_home: false },
    ];
    render(<SubjectsGrid showOnlyOnHome />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // Legacy contract: the grid forwards is_academic to the hook (default
    // true). @todo: remove after TRW refactor merge (spec 015 Contract B).
    expect((subjectsState as { lastParams?: unknown }).lastParams).toEqual({
      is_academic: true,
    });
  });

  it("academic empty state shows the CTA; non-academic shows TRW copy", () => {
    subjectsState.loading = false;
    const { rerender } = render(<SubjectsGrid />);
    expect(screen.getByText("subjects.emptyAcademicTitle")).toBeDefined();
    expect(screen.getByText("subjects.studyWithZainCta")).toBeDefined();

    rerender(<SubjectsGrid is_academic={false} />);
    expect(screen.getByText("subjects.emptyNonAcademicTitle")).toBeDefined();
    expect(screen.queryByText("subjects.studyWithZainCta")).toBeNull();
  });

  it("optimistic subjects render disabled without click", async () => {
    subjectsState.loading = false;
    subjectsState.subjects = [
      { id: "opt-1", name: "جديد", show_on_home: true, isOptimistic: true },
    ];
    const onClick = vi.fn();
    render(<SubjectsGrid onSubjectClick={onClick} />);
    const btn = await screen.findByRole("button");
    expect(btn.className).toContain("cursor-not-allowed");
  });
});
