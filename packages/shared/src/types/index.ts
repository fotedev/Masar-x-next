/**
 * Cross-platform types — re-exports the database row types and the
 * Zod schemas in a single entry point.
 *
 * Consumers SHOULD import the specific subpath:
 *   - `import type { Database, Profile } from "@masarx-shared/types"`
 *     for the row types
 *   - `import { ProfileSchema, type ValidatedProfile } from "@masarx-shared/types/schemas"`
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
  Tables,
  Enums,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  Admin,
  SystemAccessCode,
  Summary,
  SummaryInsert,
  SummaryUpdate,
  Quiz,
  QuizInsert,
  QuizUpdate,
  QuizWithRatings,
  News,
  NewsInsert,
  NewsUpdate,
  Subject,
  SubjectInsert,
  SubjectUpdate,
  SubjectLecture,
  SubjectLectureInsert,
  SubjectLectureUpdate,
  Appeal,
  AppealInsert,
  AppealUpdate,
  Notification,
  NotificationInsert,
  NotificationUpdate,
  Review,
  ReviewInsert,
  ReviewUpdate,
  ChatMessage,
  ChatMessageInsert,
  ChatMessageUpdate,
  AiSummary,
  AiSummaryInsert,
  AiSummaryUpdate,
  Course,
  CourseInsert,
  CourseUpdate,
  ReviewDetails,
  SummaryWithRatings,
  // Extended types — added in Spec 004 Phase 2 (T011) to match the
  // original `apps/web/src/types/database.ts` re-exports exactly.
  Message,
  MessageInsert,
  MessageUpdate,
  MessageWithSender,
  VideoWithRatings,
  CourseWithInstructor,
  AdminNews,
  AdminQuiz,
} from "./database";
