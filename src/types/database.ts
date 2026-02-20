export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      reviews: {
        Row: {
          id: string
          content: string
          user_id: string | null
          summary_id: string | null
          quiz_id: string | null
          course_id: string | null
          rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          user_id?: string | null
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          rating?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content?: string
          user_id?: string | null
          summary_id?: string | null
          quiz_id?: string | null
          course_id?: string | null
          rating?: number
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          level?: number | null
          semester?: number | null
          department_id?: string | null
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
          pdf_url: string | null
          contributor_name: string | null
          status: string
          user_id: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          subject: string
          year: string
          department: string
          content: string
          pdf_url?: string | null
          contributor_name?: string | null
          status?: string
          user_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          subject?: string
          year?: string
          department?: string
          content?: string
          pdf_url?: string | null
          contributor_name?: string | null
          status?: string
          user_id?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      news: {
        Row: {
          id: string
          title: string
          content: string
          type: string
          is_active: boolean
          priority: number
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          subject: string | null
          department: string | null
          year: string | null
          custom_category: string | null
          file_url: string | null
          image_urls: string[] | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          type: string
          is_active?: boolean
          priority: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          custom_category?: string | null
          file_url?: string | null
          image_urls?: string[] | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: string
          is_active?: boolean
          priority?: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          subject?: string | null
          department?: string | null
          year?: string | null
          custom_category?: string | null
          file_url?: string | null
          image_urls?: string[] | null
        }
      }
      appeals: {
        Row: {
          id: string
          content_id: string
          content_type: string
          reason: string
          description: string | null
          status: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          content_title: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          content_id: string
          content_type: string
          reason: string
          description?: string | null
          status?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          content_title?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          content_id?: string
          content_type?: string
          reason?: string
          description?: string | null
          status?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          content_title?: string | null
          reviewed_by?: string | null
        }
      }
      quizzes: {
        Row: {
          id: string
          title: string
          description: string | null
          user_id: string | null
          source_type: string
          summary_id: string | null
          created_at: string
          subject: string | null
          department: string | null
          year: string | null
          status: string
          duration_seconds: number | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          user_id?: string | null
          source_type?: string
          summary_id?: string | null
          created_at?: string
          subject?: string | null
          department?: string | null
          year?: string | null
          status?: string
          duration_seconds?: number | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          user_id?: string | null
          source_type?: string
          summary_id?: string | null
          created_at?: string
          subject?: string | null
          department?: string | null
          year?: string | null
          status?: string
          duration_seconds?: number | null
        }
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string | null
          question: string
          options: Json
          correct_answer: number
          explanation: string | null
          order_index: number | null
        }
        Insert: {
          id?: string
          quiz_id?: string | null
          question: string
          options: Json
          correct_answer: number
          explanation?: string | null
          order_index?: number | null
        }
        Update: {
          id?: string
          quiz_id?: string | null
          question?: string
          options?: Json
          correct_answer?: number
          explanation?: string | null
          order_index?: number | null
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string | null
          quiz_id: string | null
          score: number
          total_questions: number
          answers: Json | null
          started_at: string | null
          finished_at: string | null
          time_taken_seconds: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          quiz_id?: string | null
          score: number
          total_questions: number
          answers?: Json | null
          started_at?: string | null
          finished_at?: string | null
          time_taken_seconds?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          quiz_id?: string | null
          score?: number
          total_questions?: number
          answers?: Json | null
          started_at?: string | null
          finished_at?: string | null
          time_taken_seconds?: number | null
          created_at?: string | null
        }
      }
      system_logs: {
        Row: {
          id: string
          level: string
          message: string
          status_code: number | null
          request_id: string | null
          endpoint: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          level: string
          message: string
          status_code?: number | null
          request_id?: string | null
          endpoint?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          level?: string
          message?: string
          status_code?: number | null
          request_id?: string | null
          endpoint?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      analytics: {
        Row: {
          id: string
          user_id: string | null
          action_type: string
          content_type: string
          content_id: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action_type: string
          content_type: string
          content_id?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action_type?: string
          content_type?: string
          content_id?: string | null
          metadata?: Json | null
          created_at?: string | null
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
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          read: boolean
          related_id: string | null
          related_type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      chats: {
        Row: {
          id: string
          name: string | null
          type: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          type: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          type?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string | null
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id?: string | null
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string | null
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_participants: {
        Row: {
          chat_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          chat_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          chat_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      ai_summaries: {
        Row: {
          id: string
          chat_id: string | null
          summary_content: string | null
          important_messages: Json | null
          last_message_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chat_id?: string | null
          summary_content?: string | null
          important_messages?: Json | null
          last_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chat_id?: string | null
          summary_content?: string | null
          important_messages?: Json | null
          last_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assistant_messages: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          user_message: string
          assistant_response: string
          response_time_ms: number | null
          ai_model_used: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          user_message: string
          assistant_response: string
          response_time_ms?: number | null
          ai_model_used?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          user_message?: string
          assistant_response?: string
          response_time_ms?: number | null
          ai_model_used?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      password_reset_tokens: {
        Row: {
          id: string
          user_id: string | null
          email: string
          token: string
          expires_at: string
          used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          token: string
          expires_at: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          token?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          show_on_home: boolean
          semester?: number | null
          level?: number | null
          professor?: string | null
          description?: string | null
          schedule?: string | null
          location?: string | null
          status: "pending" | "approved" | "rejected"
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          show_on_home?: boolean
          semester?: number | null
          level?: number | null
          professor?: string | null
          description?: string | null
          schedule?: string | null
          location?: string | null
          status?: "pending" | "approved" | "rejected"
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          show_on_home?: boolean
          semester?: number | null
          level?: number | null
          professor?: string | null
          description?: string | null
          schedule?: string | null
          location?: string | null
          status?: "pending" | "approved" | "rejected"
          created_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string | null
          instructor_id: string
          price: number | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          instructor_id: string
          price?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          instructor_id?: string
          price?: number | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          course_id: string
          status: 'pending' | 'active' | 'expired'
          payment_screenshot_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          course_id: string
          status?: 'pending' | 'active' | 'expired'
          payment_screenshot_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          course_id?: string
          status?: 'pending' | 'active' | 'expired'
          payment_screenshot_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          operation_name: string
          user_id: string
          timestamp: string
          changed_data: Json
        }
        Insert: {
          id?: string
          operation_name: string
          user_id: string
          timestamp?: string
          changed_data: Json
        }
        Update: {
          id?: string
          operation_name?: string
          user_id?: string
          timestamp?: string
          changed_data?: Json
        }
      }
    }
    Views: {
      review_details: {
        Row: {
          id: string | null
          content: string | null
          rating: number | null
          user_id: string | null
          summary_id: string | null
          quiz_id: string | null
          course_id: string | null
          created_at: string | null
          updated_at: string | null
          full_name: string | null
          avatar_url: string | null
          username: string | null
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
          pdf_url: string | null
          contributor_name: string | null
          status: string
          user_id: string | null
          created_at: string
          updated_at: string
          avg_rating: number
          reviews_count: number
        }
      }
      quizzes_with_ratings: {
        Row: {
          id: string
          title: string
          description: string | null
          user_id: string | null
          source_type: string
          summary_id: string | null
          created_at: string
          subject: string
          department: string
          year: string
          status: string
          avg_rating: number
          reviews_count: number
        }
      }
      content_analytics: {
        Row: {
          content_id: string | null
          content_type: string | null
          views_count: number | null
          clicks_count: number | null
          unique_views_count: number | null
          last_updated: string | null
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

export type Summary = Database['public']['Tables']['summaries']['Row'];
export type SummaryWithRatings = Database['public']['Views']['summaries_with_ratings']['Row'];
export type SummaryInsert = Database['public']['Tables']['summaries']['Insert'];
export type SummaryUpdate = Database['public']['Tables']['summaries']['Update'];

export type Quiz = Database['public']['Tables']['quizzes']['Row'];
export type QuizWithRatings = Database['public']['Views']['quizzes_with_ratings']['Row'];
export type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];
export type QuizUpdate = Database['public']['Tables']['quizzes']['Update'];

export type Review = Database['public']['Tables']['reviews']['Row'];
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update'];

export type ReviewDetails = Database['public']['Views']['review_details']['Row'];

export type News = Database['public']['Tables']['news']['Row'];
export type NewsInsert = Database['public']['Tables']['news']['Insert'];
export type NewsUpdate = Database['public']['Tables']['news']['Update'];

export type Appeal = Database['public']['Tables']['appeals']['Row'];
export type AppealInsert = Database['public']['Tables']['appeals']['Insert'];
export type AppealUpdate = Database['public']['Tables']['appeals']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Admin = Database['public']['Tables']['admins']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

export type Chat = Database['public']['Tables']['chats']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type AISummary = Database['public']['Tables']['ai_summaries']['Row'];

export type MessageWithSender = Message & {
  sender: {
    id: string;
    email: string;
    raw_user_meta_data: unknown;
  } | null;
};

export type ChatWithDetails = Chat & {
  chat_participants?: { user_id: string }[];
  messages?: { id: string; created_at: string }[];
  ai_summaries?: { id: string; created_at: string; summary_content: string }[];
};
export type Subject = Database['public']['Tables']['subjects']['Row'];
export type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];
export type SubjectUpdate = Database['public']['Tables']['subjects']['Update'];

export type Course = Database['public']['Tables']['courses']['Row'];
export type CourseInsert = Database['public']['Tables']['courses']['Insert'];
export type CourseUpdate = Database['public']['Tables']['courses']['Update'];

export type Enrollment = Database['public']['Tables']['enrollments']['Row'];
export type EnrollmentInsert = Database['public']['Tables']['enrollments']['Insert'];
export type EnrollmentUpdate = Database['public']['Tables']['enrollments']['Update'];

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
