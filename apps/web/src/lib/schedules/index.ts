/**
 * Static schedules accessor (spec 034 → spec 047).
 *
 * The timetable JSONs + Zod validation + structural parsing moved to
 * `masarx-shared/schedules` (single source of truth shared with mobile).
 * This module stays as a thin re-export so every existing import keeps
 * working.
 */
export {
  scheduleSet,
  scheduleSheets,
  detectBlocks,
  headerRowIndex,
  splitDays,
  cellParts,
  subjectColorIndex,
  timeSlotHour,
  todayDayName,
  matchesDay,
  weekdayKeyOf,
  WEEKDAY_KEYS,
  extractBlockLabel,
} from "masarx-shared/schedules";
export type {
  ScheduleSheet,
  ScheduleSet,
  ScheduleBlock,
  ScheduleDayGroup,
  ScheduleCellParts,
  WeekdayKey,
} from "masarx-shared/schedules";
