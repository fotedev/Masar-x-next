export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          level: number | null
          semester: number | null
          department_id: string | null
          show_extra_assets: boolean | null
          show_extra_assets_updated_at: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          level?: number | null
          semester?: number | null
          department_id?: string | null
          show_extra_assets?: boolean | null
          show_extra_assets_updated_at?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          level?: number | null
          semester?: number | null
          department_id?: string | null
          show_extra_assets?: boolean | null
          show_extra_assets_updated_at?: string | null
        }
      }
      admins: {
        Row: {
          id: string
          user_id: string
          role: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          created_at?: string | null
        }
      }
      system_access_codes: {
        Row: {
          id: string
          access_key: string
          expires_at: string
          created_at: string
          max_uses: number
          used_count: number
        }
        Insert: {
          id?: string
          access_key: string
          expires_at: string
          created_at?: string
          max_uses?: number
          used_count?: number
        }
        Update: {
          id?: string
          access_key?: string
          expires_at?: string
          created_at?: string
          max_uses?: number
          used_count?: number
        }
      }
      summaries: {
        Row: {
          id: string
          title: string
          subject: string
          year: string
          department: string
          content: string
          created_at: string
          user_id: string
          contributor_name: string | null
          pdf_url: string | null
          status: string
          lecture_key: string | null
          lecture_id: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          subject: string
          year: string
          department: string
          content: string
          created_at?: string
          user_id: string | null
          contributor_name?: string | null
          pdf_url?: string | null
          status?: string
          lecture_key?: string | null
          lecture_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          subject?: string
          year?: string
          department?: string
          content?: string
          created_at?: string
          user_id?: string
          contributor_name?: string | null
          pdf_url?: string | null
          status?: string
          lecture_key?: string | null
          lecture_id?: string | null
          updated_at?: string | null
        }
      }
      quizzes: {
        Row: {
          id: string
          title: string
          description: string | null
          user_id: string | null
          source_type: string | null
          created_at: string | null
          summary_id: string | null
          subject: string | null
          department: string | null
          year: string | null
          status: string
          duration_seconds: number | null
          lecture_key: string | null
          lecture_id: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          user_id?: string | null
          source_type?: string | null
          created_at?: string | null
          summary_id?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          status?: string
          duration_seconds?: number | null
          lecture_key?: string | null
          lecture_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          user_id?: string | null
          source_type?: string | null
          created_at?: string | null
          summary_id?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          status?: string
          duration_seconds?: number | null
          lecture_key?: string | null
          lecture_id?: string | null
        }
      }
      news: {
        Row: {
          id: string
          title: string
          content: string
          type: string
          priority: number
          created_by: string | null
          created_at: string
          file_url: string | null
          image_urls: string[] | null
          custom_category: string | null
          subject: string | null
          department: string | null
          year: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          title: string
          content: string
          type: string
          priority?: number
          created_by?: string | null
          created_at?: string
          file_url?: string | null
          image_urls?: string[] | null
          custom_category?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: string
          priority?: number
          created_by?: string | null
          created_at?: string
          file_url?: string | null
          image_urls?: string[] | null
          custom_category?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          is_active?: boolean
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          is_academic: boolean | null
          semester: number | null
          level: number | null
          show_on_home: boolean | null
          created_at: string | null
          professor: string | null
          description: string | null
          schedule: string | null
          location: string | null
          status: string | null
        }
        Insert: {
          id?: string
          name: string
          is_academic?: boolean | null
          semester?: number | null
          level?: number | null
          show_on_home?: boolean | null
          created_at?: string | null
          professor?: string | null
          description?: string | null
          schedule?: string | null
          location?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          name?: string
          is_academic?: boolean | null
          semester?: number | null
          level?: number | null
          show_on_home?: boolean | null
          created_at?: string | null
          professor?: string | null
          description?: string | null
          schedule?: string | null
          location?: string | null
          status?: string | null
        }
      }
      appeals: {
        Row: {
          id: string
          user_id: string
          content_type: string | null
          content_id: string | null
          reason: string | null
          status: string
          reviewed_by: string | null
          created_at: string
          description: string | null
          created_by: string | null
          content_title: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          content_type?: string | null
          content_id?: string | null
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          created_at?: string
          description?: string | null
          created_by?: string | null
          content_title?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content_type?: string | null
          content_id?: string | null
          reason?: string | null
          status?: string
          reviewed_by?: string | null
          created_at?: string
          description?: string | null
          created_by?: string | null
          content_title?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          related_id: string | null
          related_type: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          related_id?: string | null
          related_type?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          related_id?: string | null
          related_type?: string | null
          read?: boolean
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          rating: number
          comment: string | null
          user_id: string
          summary_id: string | null
          quiz_id: string | null
          course_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rating: number
          comment?: string | null
          user_id: string
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rating?: number
          comment?: string | null
          user_id?: string
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          content: string
          sender_id: string
          chat_id: string
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          sender_id: string
          chat_id: string
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          sender_id?: string
          chat_id?: string
          created_at?: string
        }
      }
      ai_summaries: {
        Row: {
          id: string
          chat_id: string
          summary_content: string
          important_messages: Json | null
          last_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          summary_content: string
          important_messages?: Json | null
          last_message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          summary_content?: string
          important_messages?: Json | null
          last_message_id?: string | null
          created_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string
          instructor_id: string
          price: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          instructor_id: string
          price?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          instructor_id?: string
          price?: number
          is_published?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      review_details: {
        Row: {
          id: string
          rating: number
          comment: string | null
          user_id: string
          summary_id: string | null
          quiz_id: string | null
          course_id: string | null
          created_at: string
          reviewer_name: string | null
          reviewer_avatar: string | null
        }
        Insert: {
          id?: string
          rating: number
          comment?: string | null
          user_id: string
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          created_at?: string
          reviewer_name?: string | null
          reviewer_avatar?: string | null
        }
        Update: {
          id?: string
          rating?: number
          comment?: string | null
          user_id?: string
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          created_at?: string
          reviewer_name?: string | null
          reviewer_avatar?: string | null
        }
      }
      summaries_with_ratings: {
        Row: {
          id: string
          title: string
          subject: string
          year: string
          department: string
          content: string
          created_at: string
          user_id: string
          contributor_name: string | null
          pdf_url: string | null
          status: string
          lecture_key: string | null
          lecture_id: string | null
          updated_at: string | null
          avg_rating: number | null
          reviews_count: number | null
        }
        Insert: {
          id?: string
          title: string
          subject: string
          year: string
          department: string
          content: string
          created_at?: string
          user_id: string
          contributor_name?: string | null
          pdf_url?: string | null
          status?: string
          lecture_key?: string | null
          lecture_id?: string | null
          updated_at?: string | null
          avg_rating?: number | null
          reviews_count?: number | null
        }
        Update: {
          id?: string
          title?: string
          subject?: string
          year?: string
          department?: string
          content?: string
          created_at?: string
          user_id?: string
          contributor_name?: string | null
          pdf_url?: string | null
          status?: string
          lecture_key?: string | null
          lecture_id?: string | null
          updated_at?: string | null
          avg_rating?: number | null
          reviews_count?: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Admin = Database['public']['Tables']['admins']['Row']
export type SystemAccessCode = Database['public']['Tables']['system_access_codes']['Row']
export type Summary = Database['public']['Tables']['summaries']['Row']
export type SummaryInsert = Database['public']['Tables']['summaries']['Insert']
export type Quiz = Database['public']['Tables']['quizzes']['Row']
export type QuizInsert = Database['public']['Tables']['quizzes']['Insert']

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
export type SubjectInsert = Database['public']['Tables']['subjects']['Insert']

// Appeal types
export type Appeal = Database['public']['Tables']['appeals']['Row']
export type AppealInsert = Database['public']['Tables']['appeals']['Insert']

// Notification types
export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

// Review types
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']
export type ReviewDetails = Database['public']['Views']['review_details']['Row']

// Message types
export type Message = Database['public']['Tables']['messages']['Row']

export interface MessageWithSender extends Message {
  sender: {
    id: string
    email?: string
    raw_user_meta_data?: {
      display_name?: string
      name?: string
    } | null
  } | null
}

// Summary with ratings (view)
export type SummaryWithRatings = Database['public']['Views']['summaries_with_ratings']['Row']
export type SummaryUpdate = Database['public']['Tables']['summaries']['Update']

// Course types
export type Course = Database['public']['Tables']['courses']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']

// Course extended type with instructor name
export interface CourseWithInstructor extends Course {
  instructor_name?: string | null
  enrollments_count?: number | null
}
