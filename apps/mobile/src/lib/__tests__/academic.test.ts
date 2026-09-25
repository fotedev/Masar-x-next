/**
 * Academic helpers tests (spec 019 C4/T090) — lock the owner-note #1
 * verification: the subjects filter strings are web's useSubjects
 * .or() arguments VERBATIM (two independent chained calls).
 */
import { describe, expect, it } from "vitest";

import {
  departmentsForLevel,
  isAcademicFilter,
  levelOrNullFilter,
  resolveEffectiveLevel,
  resolveEffectiveSemester,
  semesterOrNullFilter,
  type AcademicOptions,
} from "../academic";

describe("filter strings (web useSubjects parity, owner note #1)", () => {
  it("builds the level filter exactly as web does", () => {
    expect(levelOrNullFilter(2)).toBe("level.eq.2,level.is.null");
  });

  it("builds the semester filter exactly as web does", () => {
    expect(semesterOrNullFilter(3)).toBe("semester.eq.3,semester.is.null");
  });

  it("builds the is_academic filter exactly as web does", () => {
    expect(isAcademicFilter()).toBe("is_academic.eq.true,is_academic.is.null");
  });
});

describe("resolveEffectiveSemester", () => {
  it("passes valid semesters through", () => {
    expect(resolveEffectiveSemester(1)).toBe(1);
    expect(resolveEffectiveSemester(2)).toBe(2);
    expect(resolveEffectiveSemester(3)).toBe(3);
  });

  it("defaults to 1 for null/undefined/out-of-domain values", () => {
    expect(resolveEffectiveSemester(null)).toBe(1);
    expect(resolveEffectiveSemester(undefined)).toBe(1);
    expect(resolveEffectiveSemester(0)).toBe(1);
    expect(resolveEffectiveSemester(4)).toBe(1);
  });
});

describe("resolveEffectiveLevel", () => {
  it("passes positive levels through", () => {
    expect(resolveEffectiveLevel(4)).toBe(4);
  });

  it("defaults to 1 for null/undefined/non-positive values", () => {
    expect(resolveEffectiveLevel(null)).toBe(1);
    expect(resolveEffectiveLevel(undefined)).toBe(1);
    expect(resolveEffectiveLevel(0)).toBe(1);
  });
});

describe("departmentsForLevel", () => {
  const options: AcademicOptions = {
    levels: [
      { id: "lvl-1", name: "Level 1", level_number: 1, is_active: true, sort_order: 1 },
      { id: "lvl-2", name: "Level 2", level_number: 2, is_active: true, sort_order: 2 },
    ],
    departments: [
      { id: "d1", academic_level_id: "lvl-1", name: "CS", is_active: true, sort_order: 1 },
      { id: "d2", academic_level_id: "lvl-2", name: "BIS", is_active: true, sort_order: 1 },
    ],
  };

  it("filters departments by the selected level id", () => {
    expect(departmentsForLevel(options, "lvl-1").map((d) => d.id)).toEqual(["d1"]);
  });

  it("returns no departments without a selected level", () => {
    expect(departmentsForLevel(options, null)).toEqual([]);
  });
});
