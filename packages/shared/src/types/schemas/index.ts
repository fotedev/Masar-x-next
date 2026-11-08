/**
 * Zod schemas for cross-platform runtime validation.
 *
 * Moved from `apps/web/src/lib/validations.ts` in Spec 004 Phase 2 (T011).
 * The web app's `validations.ts` becomes a thin re-export from this
 * location so existing imports keep working.
 *
 * The schemas here are intentionally hand-maintained; they describe
 * the public surface of the API (request/response envelopes, user
 * input validation) rather than database row shapes (which are
 * described by the generated `database.ts`).
 */
import { z } from "zod";

// Helper for date validation
const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: "Invalid date format",
});

// --- Profiles ---
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).nullable(),
  full_name: z.string().min(1).nullable(),
  display_name: z.string().min(1).nullable(),
  avatar_url: z.string().nullable(),
  level: z.number().int().nullable(),
  semester: z.number().int().nullable(),
  // Spec 013: semester_manually_set=true protects the student's own choice
  // from admin bulk migrations (unless the admin forces it).
  semester_manually_set: z.boolean().nullable().optional(),
  semester_updated_at: z.string().nullable().optional(),
  department_id: z.string().nullable(),
});

// --- Courses ---
// Shape = the real `courses` table (spec 031 truthful types): no
// `is_academic` column exists; `description` is nullable.
export const CourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  instructor_id: z.string().uuid(),
  price: z.number().int().default(0),
  is_published: z.boolean().default(false),
  created_at: dateSchema,
});

export const CourseWithInstructorSchema = CourseSchema.extend({
  instructor_name: z.string().min(1).optional(),
  enrollments_count: z.number().int().nullable().optional(),
  average_rating: z.number().nullable().optional(),
  total_students: z.number().int().nullable().optional(),
});

// --- News ---
export const NewsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string(),
  type: z.string(),
  priority: z.number().int().default(0),
  created_at: dateSchema,
  image_urls: z.array(z.string()).default([]),
  custom_category: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  year: z.string().regex(/^\d{4}$/).nullable().optional(),
  is_active: z.boolean().default(true),
});

// --- Quizzes ---
export const QuizSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  year: z.string().regex(/^\d{4}$/).nullable().optional(),
  // Mirrors the quizzes_status_check constraint (pending/approved/rejected).
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  created_at: dateSchema.optional().nullable(),
});

// Spec 015 US3 (T027) — Validated* helper types removed.
// They were declared as `z.infer<typeof Schema>` aliases but had no
// importers across apps/ or packages/. Consumers use the bare schema
// names (CourseSchema, NewsSchema, etc.) directly. The type aliases
// were dead exports; their inferred types live on the schemas
// themselves if anyone needs them.

// --- Waitlist (spec 021) ---
export const WaitlistSourceSchema = z.enum(["trw", "macos", "android"]);
export type WaitlistSource = z.infer<typeof WaitlistSourceSchema>;

export const WaitlistSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: WaitlistSourceSchema,
});

// --- Schedules (spec 034) ---
// Shape of the static timetable JSONs at apps/web/src/lib/schedules/ (extracted
// from the public group Google Sheets via the sandbox gviz pipeline).

// Module-private: consumed only by ScheduleSetSchema below — no external
// importers, so the dead-export guard (unused-exports-guard.test.ts) wants
// the `export` keyword off.
const ScheduleSheetSchema = z.object({
  id: z.string().min(1),
  docId: z.string().min(10),
  /** Tab name in the source spreadsheet (e.g. "الفرقة الثانية"). */
  tab: z.string().min(1).nullable(),
  gid: z.string().optional(),
  fetchedAt: z.string(),
  sourceUrl: z.string(),
  rowCount: z.number().int().positive(),
  colCount: z.number().int().positive(),
  /** Raw flattened grid — cells may contain multi-line "subject/staff/room". */
  rows: z.array(z.array(z.string())),
});
export type ScheduleSheet = z.infer<typeof ScheduleSheetSchema>;

export const ScheduleSetSchema = z.object({
  sheets: z.array(ScheduleSheetSchema).min(1),
});
export type ScheduleSet = z.infer<typeof ScheduleSetSchema>;

// --- Drive materials (spec 033) ---
// Shape of the static manifest at apps/web/src/lib/materials/manifest.json
// (sync-maintained by the drive-materials sandbox tooling; 84 files, term-tagged).

// Module-private: consumed only by DriveGroupSchema below.
const DriveFileSchema = z.object({
  name: z.string().min(1),
  fileId: z.string().min(10),
  type: z.string(),
  /** Null when Drive reports no modified date for the file. */
  modified: z.string().nullable(),
});
export type DriveFile = z.infer<typeof DriveFileSchema>;

/** A Drive folder group; `children` nests subgroup levels (recursive). */
export type DriveGroup = {
  name: string;
  nameAr: string;
  folderId: string;
  files: DriveFile[];
  children?: DriveGroup[];
};

// Module-private: consumed only by DriveSubjectSchema's recursive nesting.
const DriveGroupSchema: z.ZodType<DriveGroup> = z.object({
  name: z.string(),
  nameAr: z.string(),
  folderId: z.string(),
  files: z.array(DriveFileSchema),
  children: z.array(z.lazy(() => DriveGroupSchema)).optional(),
});

// Module-private: consumed only by DriveManifestSchema below.
const DriveSubjectSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().min(1),
  icon: z.string(),
  /** null for stub subjects that have no Drive folder yet (coming-soon state). */
  folderId: z.string().nullable(),
  groups: z.array(DriveGroupSchema),
  level: z.number().int().positive(),
  semester: z.number().int().positive(),
  stub: z.boolean().optional(),
});
export type DriveSubject = z.infer<typeof DriveSubjectSchema>;

// Module-private: consumed only by DriveManifestSchema below.
const DriveManifestSourceSchema = z.object({
  name: z.string(),
  folderId: z.string(),
  url: z.string(),
  note: z.string().optional(),
});

export const DriveManifestSchema = z.object({
  generated: z.string(),
  source: DriveManifestSourceSchema,
  embedFormat: z.string(),
  subjects: z.array(DriveSubjectSchema),
  lastSyncRun: z.string().optional(),
});
export type DriveManifest = z.infer<typeof DriveManifestSchema>;
