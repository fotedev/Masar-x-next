/**
 * Static schedules data + structural parser (spec 047).
 *
 * The timetables are extracted from the public group Google Sheets by the
 * drive-materials sandbox pipeline (gviz CSV) and stored here as build-time
 * assets — same doctrine as the materials manifest (spec 033) and the
 * original spec 034 placement in apps/web (moved here so mobile consumes
 * the same validated data).
 *
 * Data shape (verified against the live sheet, 2026-11-13):
 *   row 0      — banner / block labels (university banner may embed a block
 *                label after "أرقام الفصول")
 *   row 1      — section numbers ("1".."8") per block
 *   rows 2..   — data rows: [اليوم, الوقت, …section cells] repeated per
 *                department block; the day cell is only filled on the first
 *                row of each day (forward-fill).
 *
 * Parsing doctrine (inherited from spec 034): structure only — cell TEXT is
 * never split into semantic fields. `cellParts` merely normalizes
 * whitespace/newlines for presentation; the union of (block, section, row)
 * lookups reproduces every non-empty body cell (unit-tested).
 */
import f1 from "./data/timetable-2025-26-f1.json";
import f2 from "./data/timetable-2025-26-f2.json";
import f3 from "./data/timetable-2025-26-f3.json";
import f4 from "./data/timetable-2025-26-f4.json";
import { ScheduleSetSchema, type ScheduleSheet } from "../types/schemas";

export type { ScheduleSheet, ScheduleSet } from "../types/schemas";

const parsed = ScheduleSetSchema.safeParse({
  sheets: [f1, f2, f3, f4],
});
if (!parsed.success) {
  throw new Error(`Invalid schedules data: ${parsed.error.message}`);
}

/** Schema-validated set of the 4 cohort sheets (f1..f4). */
export const scheduleSet = parsed.data;
/** Convenience accessor — the sheets in cohort order. */
export const scheduleSheets: ScheduleSheet[] = parsed.data.sheets;

// --- structural model --------------------------------------------------------

/** Time-slot cell shape, e.g. "08 - 09" (first group = start hour). */
const TIME_SLOT_RE = /^(\d{1,2})\s*-\s*\d{1,2}$/;

/**
 * One department block of a sheet: its own اليوم/الوقت columns plus the
 * section columns that follow. All indexes are sheet-column indexes.
 */
export interface ScheduleBlock {
  /** Column index of the day (اليوم) column — always timeCol − 1. */
  dayCol: number;
  /** Column index of the time (الوقت) column. */
  timeCol: number;
  /** Section column indexes, left to right (trailing all-empty columns trimmed). */
  sectionCols: number[];
  /**
   * Labels extracted from the header row (banner tails after "أرقام الفصول"
   * included), in document order. `null` when nothing could be extracted —
   * the UI falls back to a generic localized label.
   */
  label: string | null;
}

/** A forward-filled day group within one block. */
export interface ScheduleDayGroup {
  /** Day name exactly as written in the sheet, e.g. "السبت" / "الاحد". */
  day: string;
  /** Data-row indexes (into `sheet.rows`) belonging to this day, in order. */
  rowIndexes: number[];
}

const DAY_ALIASES = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة", "السبت"] as const;

/**
 * Index of the real header row — the first row carrying a bare "اليوم"
 * cell. f1/f2/f4 put it at row 0 (banner shares the row); f3 spreads its
 * banner over rows 0-2 so the header lands at row 3. Everything below is
 * relative to this anchor: header+1 = section numbers, header+2+ = data.
 */
export function headerRowIndex(sheet: ScheduleSheet): number {
  const limit = Math.min(sheet.rows.length, 8);
  for (let r = 0; r < limit; r++) {
    if (sheet.rows[r].some((c) => (c ?? "").trim() === "اليوم")) return r;
  }
  return 0;
}

function isTimeColumn(sheet: ScheduleSheet, col: number, dataStart: number): boolean {
  let seen = 0;
  const values = new Set<string>();
  for (let r = dataStart; r < sheet.rows.length; r++) {
    const cell = (sheet.rows[r][col] ?? "").trim();
    if (!cell) continue;
    if (!TIME_SLOT_RE.test(cell)) return false;
    values.add(cell);
    seen++;
  }
  // A real time column carries the full day grid (≥6 distinct slots);
  // guards against a section column that happens to hold dash numerics.
  return seen >= 6 && values.size >= 6;
}

/**
 * Detect the department blocks of a sheet from its time columns. The time
 * column anchors each block; the day column sits immediately to its left and
 * the section columns run to the next block's day column. Trailing
 * all-empty section columns are trimmed.
 */
export function detectBlocks(sheet: ScheduleSheet): ScheduleBlock[] {
  const headRow = headerRowIndex(sheet);
  const sectionRow = headRow + 1;
  const dataStart = headRow + 2;
  const timeCols: number[] = [];
  for (let c = 0; c < sheet.colCount; c++) {
    if (isTimeColumn(sheet, c, dataStart)) timeCols.push(c);
  }

  return timeCols.map((timeCol, i) => {
    const dayCol = timeCol - 1;
    const nextDayCol = i + 1 < timeCols.length ? timeCols[i + 1] - 1 : sheet.colCount;
    const sectionCols: number[] = [];
    for (let c = timeCol + 1; c < nextDayCol; c++) {
      sectionCols.push(c);
    }
    // Trim trailing padding columns — empty in the section-number row AND
    // all data rows (a labeled-but-class-free section column is kept).
    while (
      sectionCols.length > 0 &&
      (sheet.rows[sectionRow]?.[sectionCols[sectionCols.length - 1]] ?? "").trim() === "" &&
      sheet.rows.slice(dataStart).every((row) => (row[sectionCols[sectionCols.length - 1]] ?? "").trim() === "")
    ) {
      sectionCols.pop();
    }
    return {
      dayCol,
      timeCol,
      sectionCols,
      label: extractBlockLabel(sheet, headRow, dayCol, sectionCols),
    };
  });
}

/** Header keywords that never name a block. */
const NON_LABEL_RE = /^(اليوم|الوقت)$/;
const BANNER_RE = /جامعة أسيوط|جدول العام/;

/**
 * Extract display labels for a block from the header row: non-empty cells
 * inside the block span that are not اليوم/الوقت and not the university
 * banner — except that a banner cell's tail after the last "أرقام الفصول"
 * marker IS a label (f1 embeds "هندسة البرمجيات (1) (92)" there). Returns
 * null when nothing usable is found.
 */
export function extractBlockLabel(
  sheet: ScheduleSheet,
  headerRow: number,
  dayCol: number,
  sectionCols: number[],
): string | null {
  const start = Math.min(dayCol, ...sectionCols);
  const end = Math.max(dayCol, ...sectionCols);
  const labels: string[] = [];
  for (let c = start; c <= end && c < (sheet.rows[headerRow]?.length ?? 0); c++) {
    const cell = (sheet.rows[headerRow]?.[c] ?? "").trim();
    if (!cell || NON_LABEL_RE.test(cell)) continue;
    if (BANNER_RE.test(cell)) {
      const tail = cell.split("أرقام الفصول").pop()?.trim();
      if (tail) labels.push(tail);
      continue;
    }
    if (!labels.includes(cell)) labels.push(cell);
  }
  if (labels.length === 0) return null;
  return labels.join(" · ");
}

/**
 * Group a block's data rows by forward-filled day column. Rows before the
 * first day name are skipped (none in the real data).
 */
export function splitDays(sheet: ScheduleSheet, block: ScheduleBlock): ScheduleDayGroup[] {
  const groups: ScheduleDayGroup[] = [];
  let current: ScheduleDayGroup | null = null;
  for (let r = headerRowIndex(sheet) + 2; r < sheet.rows.length; r++) {
    const day = (sheet.rows[r][block.dayCol] ?? "").trim();
    if (day) {
      current = { day, rowIndexes: [] };
      groups.push(current);
    }
    if (current) current.rowIndexes.push(r);
  }
  return groups;
}

export interface ScheduleCellParts {
  /** First non-empty presentation line (whitespace-normalized). */
  primary: string;
  /** Remaining lines (whitespace-normalized), staff/room etc. */
  secondary: string[];
}

/**
 * Presentation split of a raw cell: split on newlines, collapse internal
 * whitespace runs (the sheet packs "subject␠␠␠staff␠␠␠room" into single
 * lines sometimes), drop empties. No semantic field parsing — the text is
 * rendered as-is, just readable.
 */
export function cellParts(cell: string): ScheduleCellParts {
  const lines = cell
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);
  return { primary: lines[0] ?? "", secondary: lines.slice(1) };
}

/** Parse "08 - 09" into its start hour (8); null when not a time slot. */
export function timeSlotHour(cell: string): number | null {
  const match = TIME_SLOT_RE.exec(cell.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * Stable palette index (0..7) for a subject line — FNV-1a over the
 * normalized primary text so the same subject keeps one color everywhere
 * (per sheet render, day switch, and locale).
 */
export function subjectColorIndex(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 8;
}

/** Strip alef/ya variants + tatweel so "الأحد" and "الاحد" match. */
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim();
}

/** Sheet-spelling weekday equality (hamza-insensitive). */
export function matchesDay(sheetDay: string, reference: string): boolean {
  return normalizeArabic(sheetDay) === normalizeArabic(reference);
}

/** Locale-neutral weekday keys, in JS getDay() order (0 = Sunday). */
export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/**
 * Canonical weekday key for a sheet day name ("السبت" → "saturday") — lets
 * every consumer render localized labels for data-authored Arabic days.
 * null when the name is not a recognizable weekday.
 */
export function weekdayKeyOf(sheetDay: string): WeekdayKey | null {
  const normalized = normalizeArabic(sheetDay);
  const idx = DAY_ALIASES.findIndex((alias) => normalizeArabic(alias) === normalized);
  return idx === -1 ? null : WEEKDAY_KEYS[idx];
}

/**
 * Today's weekday in the sheets' spelling ("الاحد" without hamza — the form
 * the data actually uses). Pure function of the passed date.
 */
export function todayDayName(date: Date = new Date()): string {
  // JS getDay(): 0 = Sunday … 6 = Saturday.
  return DAY_ALIASES[date.getDay()];
}
