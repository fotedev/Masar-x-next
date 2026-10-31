/**
 * Shared database types — entry point.
 *
 * `Database` / `Json` come from `database.generated.ts`, which is GENERATED
 * from the production schema (`supabase gen types typescript --linked`, or
 * the Supabase MCP `generate_typescript_types`) — never hand-edit it. See
 * `supabase/migrations/README.md` (spec 031, 2026-10-31). This file keeps
 * the hand-written derived aliases consumers rely on, so regenerating the
 * generated file never wipes them.
 */
import type { Database } from "./database.generated";

export * from "./database.generated";

export type Summary = Database['public']['Tables']['summaries']['Row']
export type SummaryUpdate = Database['public']['Tables']['summaries']['Update']
export type Quiz = Database['public']['Tables']['quizzes']['Row']

export interface QuizWithRatings extends Quiz {
  avg_rating?: number | null;
  total_ratings?: number | null;
  reviews_count?: number | null;
}

// News types
export type News = Database['public']['Tables']['news']['Row']
export type NewsInsert = Database['public']['Tables']['news']['Insert']

// Subject types
export type Subject = Database['public']['Tables']['subjects']['Row']

// Appeals
export type Appeal = Database['public']['Tables']['appeals']['Row']
export type AppealInsert = Database['public']['Tables']['appeals']['Insert']

// Notifications
export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

// Reviews
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']

// Courses
export type Course = Database['public']['Tables']['courses']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']

// View types
export type ReviewDetails = Database['public']['Views']['review_details']['Row']
export type SummaryWithRatings = Database['public']['Views']['summaries_with_ratings']['Row']

// Videos with ratings (extended view)
export interface VideoWithRatings {
  id: string
  subject: string
  title: string
  url: string
  language: 'ar' | 'en'
  user_id: string
  created_at: string
  lecture_key?: string | null
  lecture_id?: string | null
  avg_rating?: number | null
  reviews_count?: number | null
}

// Course extended type with instructor name and stats
export interface CourseWithInstructor extends Course {
  instructor_name?: string | null
  enrollments_count?: number | null
  average_rating?: number | null
  total_students?: number | null
}

// Admin-specific news type with targeting fields
export interface AdminNews extends News {
  subject: string | null
  department: string | null
  year: string | null
}

// Admin-specific quiz type
export interface AdminQuiz extends Quiz {
  subject: string | null
  department: string | null
  year: string | null
}
