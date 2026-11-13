import { describe, expect, it } from "vitest";

import {
  cellParts,
  detectBlocks,
  headerRowIndex,
  matchesDay,
  scheduleSheets,
  splitDays,
  subjectColorIndex,
  timeSlotHour,
  todayDayName,
} from "../index";

/**
 * Spec 047 — structural parser over the 4 real cohort sheets. The core
 * invariant: the union of (day, time, section) columns of the detected
 * blocks covers EVERY non-empty cell of every sheet — no cell may become
 * unreachable by the section-matrix view (spec 034 fidelity doctrine).
 */

describe("schedules data (moved to shared, spec 047)", () => {
  it("exposes the 4 cohort sheets in order", () => {
    expect(scheduleSheets.map((s) => s.id)).toEqual([
      "timetable-2025-26-f1",
      "timetable-2025-26-f2",
      "timetable-2025-26-f3",
      "timetable-2025-26-f4",
    ]);
    for (const sheet of scheduleSheets) {
      expect(sheet.rows.length).toBe(sheet.rowCount);
    }
  });
});

describe("detectBlocks", () => {
  it("anchors the header row (f3 spreads its banner over rows 0-2)", () => {
    expect(headerRowIndex(scheduleSheets[0])).toBe(0);
    expect(headerRowIndex(scheduleSheets[1])).toBe(0);
    expect(headerRowIndex(scheduleSheets[2])).toBe(3);
    expect(headerRowIndex(scheduleSheets[3])).toBe(0);
  });

  it("finds the 3 verified blocks of f1 (day/time/sections)", () => {
    const f1 = scheduleSheets[0];
    const blocks = detectBlocks(f1);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ dayCol: 0, timeCol: 1 });
    expect(blocks[0].sectionCols).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(blocks[1]).toMatchObject({ dayCol: 10, timeCol: 11 });
    expect(blocks[1].sectionCols).toEqual([12, 13, 14, 15, 16]);
    expect(blocks[2]).toMatchObject({ dayCol: 17, timeCol: 18 });
    expect(blocks[2].sectionCols).toEqual([19, 20, 21, 22]);
  });

  it("extracts real block labels (banner tails + header cells)", () => {
    const f1 = scheduleSheets[0];
    const labels = detectBlocks(f1).map((b) => b.label);
    expect(labels[0]).toContain("هندسة البرمجيات");
    expect(labels[1]).toContain("علوم الحاسب");
    expect(labels[2]).toContain("الذكاء الاصطناعي");
    for (const label of labels) expect(label).not.toContain("جامعة أسيوط");
  });

  it("finds f3's blocks despite its 3-row banner (verified spans)", () => {
    const f3 = scheduleSheets[2];
    const blocks = detectBlocks(f3);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ dayCol: 0, timeCol: 1 });
    expect(blocks[1]).toMatchObject({ dayCol: 8, timeCol: 9 });
    expect(blocks[2]).toMatchObject({ dayCol: 15, timeCol: 16 });
    expect(blocks[0].label).toContain("علوم الحاسب");
    expect(blocks[1].label).toContain("ذكاء اصطناعي");
    expect(blocks[2].label).toContain("هندسة البرمجيات");
  });

  it("every block has at least one section column in every sheet", () => {
    for (const sheet of scheduleSheets) {
      const blocks = detectBlocks(sheet);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.sectionCols.length).toBeGreaterThan(0);
        expect(block.timeCol).toBe(block.dayCol + 1);
        for (const col of block.sectionCols) expect(col).toBeGreaterThan(block.timeCol);
      }
    }
  });

  it("COVERAGE: every non-empty cell of every sheet is reachable via a block column", () => {
    for (const sheet of scheduleSheets) {
      const blocks = detectBlocks(sheet);
      const covered = new Set<number>();
      for (const b of blocks) {
        covered.add(b.dayCol);
        covered.add(b.timeCol);
        for (const c of b.sectionCols) covered.add(c);
      }
      for (let r = headerRowIndex(sheet); r < sheet.rows.length; r++) {
        for (let c = 0; c < sheet.rows[r].length; c++) {
          const cell = (sheet.rows[r][c] ?? "").trim();
          if (!cell) continue;
          expect(
            covered.has(c),
            `${sheet.id} row ${r} col ${c} "${cell.slice(0, 30)}" is not covered by any block`,
          ).toBe(true);
        }
      }
    }
  });

  it("time columns only contain time slots; day columns only day names", () => {
    const timeSlotRe = /^\d{1,2}\s*-\s*\d{1,2}$/;
    for (const sheet of scheduleSheets) {
      const dataStart = headerRowIndex(sheet) + 2;
      for (const block of detectBlocks(sheet)) {
        const timeValues = sheet.rows
          .slice(dataStart)
          .map((row) => (row[block.timeCol] ?? "").trim())
          .filter(Boolean);
        expect(timeValues.length).toBeGreaterThan(0);
        for (const v of timeValues) expect(v).toMatch(timeSlotRe);
        const dayValues = sheet.rows
          .slice(dataStart)
          .map((row) => (row[block.dayCol] ?? "").trim())
          .filter(Boolean);
        for (const v of dayValues) expect(v).not.toMatch(timeSlotRe);
      }
    }
  });
});

describe("splitDays", () => {
  it("forward-fills the day column into 6 day groups for f1 (72 data rows)", () => {
    const f1 = scheduleSheets[0];
    const days = splitDays(f1, detectBlocks(f1)[0]);
    expect(days.map((d) => d.day)).toEqual(["السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس"]);
    expect(days.reduce((n, d) => n + d.rowIndexes.length, 0)).toBe(72);
    // Consecutive, gap-free row ranges.
    let expected = 2;
    for (const group of days) {
      for (const r of group.rowIndexes) {
        expect(r).toBe(expected);
        expected++;
      }
    }
  });

  it("each day group carries the day name only on its first row in the source", () => {
    const f1 = scheduleSheets[0];
    const days = splitDays(f1, detectBlocks(f1)[0]);
    for (const group of days) {
      for (let i = 1; i < group.rowIndexes.length; i++) {
        expect((f1.rows[group.rowIndexes[i]][0] ?? "").trim()).toBe("");
      }
    }
  });
});

describe("cellParts", () => {
  it("splits multi-line cells and collapses whitespace runs", () => {
    const parts = cellParts("التواصل الشخصي - مدرج C215\nد/ دعاء محمود محمد  -  د/ هدير");
    expect(parts.primary).toBe("التواصل الشخصي - مدرج C215");
    expect(parts.secondary).toEqual(["د/ دعاء محمود محمد - د/ هدير"]);
  });

  it("normalizes the wide-space single-line cells to one primary line", () => {
    const parts = cellParts("دوائر رقمية                    م.م. ابراهيم                    قاعة درس C030");
    expect(parts.primary).toBe("دوائر رقمية م.م. ابراهيم قاعة درس C030");
    expect(parts.secondary).toEqual([]);
  });

  it("empty cell → empty primary", () => {
    expect(cellParts("").primary).toBe("");
    expect(cellParts("   \n  ").secondary).toEqual([]);
  });
});

describe("timeSlotHour", () => {
  it("parses slot starts", () => {
    expect(timeSlotHour("08 - 09")).toBe(8);
    expect(timeSlotHour("12 - 01")).toBe(12);
    expect(timeSlotHour("01 - 02")).toBe(1);
  });
  it("rejects non-slot cells", () => {
    expect(timeSlotHour("السبت")).toBeNull();
    expect(timeSlotHour("")).toBeNull();
    expect(timeSlotHour("رياضيات 2")).toBeNull();
  });
});

describe("subjectColorIndex", () => {
  it("is stable and in range for real cell text", () => {
    const samples = scheduleSheets[0].rows.flat().filter((c) => c.trim());
    for (const s of samples) {
      const idx = subjectColorIndex(s);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(8);
      expect(subjectColorIndex(s)).toBe(idx);
    }
  });
  it("ignores whitespace differences", () => {
    expect(subjectColorIndex("رياضيات 2 - مدرج C221")).toBe(
      subjectColorIndex("رياضيات 2   -   مدرج C221"),
    );
  });
});

describe("weekday helpers", () => {
  it("maps JS weekdays to the sheets' spelling", () => {
    // 2026-01-01 = Thursday, 2026-01-03 = Saturday (verified calendar).
    expect(todayDayName(new Date(2026, 0, 1))).toBe("الخميس");
    expect(todayDayName(new Date(2026, 0, 3))).toBe("السبت");
    expect(todayDayName(new Date(2026, 0, 2))).toBe("الجمعة");
  });
  it("matches hamza variants (الأحد ↔ الاحد)", () => {
    expect(matchesDay("الأحد", "الاحد")).toBe(true);
    expect(matchesDay("السبت", "السبت")).toBe(true);
    expect(matchesDay("السبت", "الخميس")).toBe(false);
  });
  it("every sheet day name matches exactly one sheet weekday", () => {
    const weekdays = ["السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس"];
    const f1Days = splitDays(scheduleSheets[0], detectBlocks(scheduleSheets[0])[0]).map((d) => d.day);
    for (const day of f1Days) {
      expect(weekdays.filter((w) => matchesDay(day, w))).toHaveLength(1);
    }
  });
});
