/**
 * Static schedules accessor (spec 034).
 *
 * The timetables are extracted from the public group Google Sheets by the
 * drive-materials sandbox pipeline (gviz CSV) and copied here as build-time
 * assets — same doctrine as the materials manifest. Exam schedules are
 * intentionally excluded (owner deferred them — exam period over).
 */
import f1 from "./timetable-2025-26-f1.json";
import f2 from "./timetable-2025-26-f2.json";
import f3 from "./timetable-2025-26-f3.json";
import f4 from "./timetable-2025-26-f4.json";
import {
  ScheduleSetSchema,
  type ScheduleSheet,
  type ScheduleSet,
} from "masarx-shared/types/schemas";

export type { ScheduleSheet, ScheduleSet };

const parsed = ScheduleSetSchema.safeParse({
  sheets: [f1, f2, f3, f4],
});
if (!parsed.success) {
  throw new Error(`Invalid schedules data: ${parsed.error.message}`);
}

export const scheduleSet: ScheduleSet = parsed.data;
export const scheduleSheets: ScheduleSheet[] = parsed.data.sheets;
