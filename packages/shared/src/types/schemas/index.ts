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
  department_id: z.string().nullable(),
});

// --- Courses ---
export const CourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  instructor_id: z.string().uuid(),
  price: z.number().int().default(0),
  is_published: z.boolean().default(false),
  is_academic: z.boolean().default(true),
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
  status: z.string().default("draft"),
  created_at: dateSchema.optional().nullable(),
});

// Helper types inferred from schemas
export type ValidatedCourse = z.infer<typeof CourseSchema>;
export type ValidatedCourseWithInstructor = z.infer<typeof CourseWithInstructorSchema>;
export type ValidatedNews = z.infer<typeof NewsSchema>;
export type ValidatedQuiz = z.infer<typeof QuizSchema>;
export type ValidatedProfile = z.infer<typeof ProfileSchema>;
