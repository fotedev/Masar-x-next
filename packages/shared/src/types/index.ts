/**
 * Cross-platform types — re-exports the database row types and the
 * Zod schemas in a single entry point.
 *
 * Consumers SHOULD import the specific subpath:
 *   - `import type { Database, Profile } from "@masarx-shared/types"`
 *     for the row types
 *   - `import { ProfileSchema } from "@masarx-shared/types/schemas"`
 *     for the Zod schemas
 *
 * The re-export of `database.ts` here is for convenience when a single
 * import site wants both row types and helpers; the schemas re-export
 * is intentionally NOT here because Zod brings a meaningful bundle
 * weight and apps that only need the row types shouldn't pay for it.
 */
export type {
  Database,
  Json,
  Summary,
  SummaryUpdate,
  Quiz,
  QuizWithRatings,
  News,
  NewsInsert,
  Subject,
  Appeal,
  AppealInsert,
  Notification,
  NotificationInsert,
  ReviewInsert,
  Course,
  CourseInsert,
  ReviewDetails,
  SummaryWithRatings,
  // Extended types — added in Spec 004 Phase 2 (T011) to match the
  // original `apps/web/src/types/database.ts` re-exports exactly.
  VideoWithRatings,
  CourseWithInstructor,
  AdminNews,
  AdminQuiz,
} from "./database";
