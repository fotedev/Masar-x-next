/**
 * GENERATED FILE — do not edit.
 *
 * Source of truth: the production database schema (project jcufigozkhxazjbwhjjm).
 * Regenerate with `pnpm types:generate` (supabase gen types typescript --linked)
 * or the Supabase MCP `generate_typescript_types` after every applied migration.
 * Baseline introduced in spec 031 (2026-10-31); see supabase/migrations/README.md.
 * Derived consumer aliases live in `database.ts`, never here.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          level_number: number | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          level_number?: number | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          level_number?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          notes: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          notes?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          notes?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mode: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mode?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mode?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          chat_id: string | null
          created_at: string | null
          id: string
          important_messages: Json | null
          last_message_id: string | null
          summary_content: string | null
          updated_at: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          important_messages?: Json | null
          last_message_id?: string | null
          summary_content?: string | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          important_messages?: Json | null
          last_message_id?: string | null
          summary_content?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summaries_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          action_type: string
          content_id: string | null
          content_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          content_id?: string | null
          content_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          content_id?: string | null
          content_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          content_id: string
          content_title: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reason: string
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_title?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reason: string
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_title?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reason?: string
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appeals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          ai_model_used: string | null
          assistant_response: string
          created_at: string | null
          id: string
          metadata: Json | null
          response_time_ms: number | null
          session_id: string | null
          user_id: string | null
          user_message: string
        }
        Insert: {
          ai_model_used?: string | null
          assistant_response: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          session_id?: string | null
          user_id?: string | null
          user_message: string
        }
        Update: {
          ai_model_used?: string | null
          assistant_response?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          session_id?: string | null
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changed_data: Json
          id: string
          operation_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          changed_data: Json
          id?: string
          operation_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          changed_data?: Json
          id?: string
          operation_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          chat_id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_analytics: {
        Row: {
          clicks_count: number | null
          content_id: string
          content_type: string
          id: string
          last_updated: string | null
          shares_count: number | null
          unique_views_count: number | null
          views_count: number | null
        }
        Insert: {
          clicks_count?: number | null
          content_id: string
          content_type: string
          id?: string
          last_updated?: string | null
          shares_count?: number | null
          unique_views_count?: number | null
          views_count?: number | null
        }
        Update: {
          clicks_count?: number | null
          content_id?: string
          content_type?: string
          id?: string
          last_updated?: string | null
          shares_count?: number | null
          unique_views_count?: number | null
          views_count?: number | null
        }
        Relationships: []
      }
      course_files: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          order_index: number
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          order_index?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_summaries: {
        Row: {
          content: string
          course_id: string
          created_at: string | null
          id: string
          order_index: number
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_summaries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_videos: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          language: string
          order_index: number
          title: string
          updated_at: string | null
          video_url: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          language: string
          order_index?: number
          title: string
          updated_at?: string | null
          video_url: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          language?: string
          order_index?: number
          title?: string
          updated_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_videos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instructor_id: string
          is_published: boolean
          price: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_id: string
          is_published?: boolean
          price?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_id?: string
          is_published?: boolean
          price?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          academic_level_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          academic_level_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          academic_level_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_academic_level_id_fkey"
            columns: ["academic_level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          payment_screenshot_url: string | null
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          payment_screenshot_url?: string | null
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          payment_screenshot_url?: string | null
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exhausted_api_keys: {
        Row: {
          api_key: string
          exhausted_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          api_key: string
          exhausted_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          api_key?: string
          exhausted_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhausted_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhausted_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string | null
          description: string | null
          file_url: string
          id: string
          lecture_id: string | null
          lecture_key: string | null
          subject: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_url: string
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          subject: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_url?: string
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          subject?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "subject_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_logs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          ip_hash: string | null
          link_id: string | null
          postal_code: string | null
          referrer: string | null
          region: string | null
          timezone: string | null
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          link_id?: string | null
          postal_code?: string | null
          referrer?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          link_id?: string | null
          postal_code?: string | null
          referrer?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          created_at: string | null
          id: string
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          custom_category: string | null
          department: string | null
          file_url: string | null
          id: string
          image_urls: string[] | null
          is_active: boolean
          priority: number
          subject: string | null
          title: string
          type: string
          updated_at: string | null
          year: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          custom_category?: string | null
          department?: string | null
          file_url?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          priority?: number
          subject?: string | null
          title: string
          type?: string
          updated_at?: string | null
          year?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          custom_category?: string | null
          department?: string | null
          file_url?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          priority?: number
          subject?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string | null
          token_hash: string
          updated_at: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token?: string | null
          token_hash: string
          updated_at?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string | null
          token_hash?: string
          updated_at?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department_id: string | null
          display_name: string | null
          extra_assets_entitled: boolean
          full_name: string | null
          id: string
          level: number | null
          semester: number | null
          semester_manually_set: boolean
          semester_updated_at: string | null
          show_extra_assets: boolean | null
          show_extra_assets_updated_at: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          display_name?: string | null
          extra_assets_entitled?: boolean
          full_name?: string | null
          id: string
          level?: number | null
          semester?: number | null
          semester_manually_set?: boolean
          semester_updated_at?: string | null
          show_extra_assets?: boolean | null
          show_extra_assets_updated_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          display_name?: string | null
          extra_assets_entitled?: boolean
          full_name?: string | null
          id?: string
          level?: number | null
          semester?: number | null
          semester_manually_set?: boolean
          semester_updated_at?: string | null
          show_extra_assets?: boolean | null
          show_extra_assets_updated_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          created_at: string | null
          finished_at: string | null
          id: string
          quiz_id: string | null
          score: number
          started_at: string | null
          time_taken_seconds: number | null
          total_questions: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          finished_at?: string | null
          id?: string
          quiz_id?: string | null
          score: number
          started_at?: string | null
          time_taken_seconds?: number | null
          total_questions: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          finished_at?: string | null
          id?: string
          quiz_id?: string | null
          score?: number
          started_at?: string | null
          time_taken_seconds?: number | null
          total_questions?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: number
          explanation: string | null
          id: string
          image_url: string | null
          options: Json
          order_index: number | null
          question: string
          quiz_id: string | null
        }
        Insert: {
          correct_answer: number
          explanation?: string | null
          id?: string
          image_url?: string | null
          options: Json
          order_index?: number | null
          question: string
          quiz_id?: string | null
        }
        Update: {
          correct_answer?: number
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json
          order_index?: number | null
          question?: string
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          lecture_id: string | null
          lecture_key: string | null
          source_type: string | null
          status: string
          subject: string | null
          summary_id: string | null
          title: string
          user_id: string | null
          year: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          source_type?: string | null
          status?: string
          subject?: string | null
          summary_id?: string | null
          title: string
          user_id?: string | null
          year?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          source_type?: string | null
          status?: string
          subject?: string | null
          summary_id?: string | null
          title?: string
          user_id?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "subject_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string
          course_id: string | null
          created_at: string | null
          id: string
          quiz_id: string | null
          rating: number
          summary_id: string | null
          updated_at: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          content: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          quiz_id?: string | null
          rating?: number
          summary_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          content?: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          quiz_id?: string | null
          rating?: number
          summary_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "lectures_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_lectures: {
        Row: {
          created_at: string | null
          id: string
          lecture_key: string
          lecture_label: string
          order_index: number
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lecture_key: string
          lecture_label: string
          order_index?: number
          subject: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lecture_key?: string
          lecture_label?: string
          order_index?: number
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          is_academic: boolean | null
          level: number | null
          location: string | null
          name: string
          name_en: string | null
          professor: string | null
          professor_ar: string | null
          professor_gender: string | null
          schedule: string | null
          semester: number | null
          show_on_home: boolean | null
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_academic?: boolean | null
          level?: number | null
          location?: string | null
          name: string
          name_en?: string | null
          professor?: string | null
          professor_ar?: string | null
          professor_gender?: string | null
          schedule?: string | null
          semester?: number | null
          show_on_home?: boolean | null
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_academic?: boolean | null
          level?: number | null
          location?: string | null
          name?: string
          name_en?: string | null
          professor?: string | null
          professor_ar?: string | null
          professor_gender?: string | null
          schedule?: string | null
          semester?: number | null
          show_on_home?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      summaries: {
        Row: {
          content: string
          contributor_name: string | null
          created_at: string | null
          department: string
          id: string
          lecture_id: string | null
          lecture_key: string | null
          pdf_url: string | null
          status: string
          subject: string
          title: string
          updated_at: string | null
          user_id: string | null
          year: string
          youtube_url: string | null
        }
        Insert: {
          content: string
          contributor_name?: string | null
          created_at?: string | null
          department: string
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          pdf_url?: string | null
          status?: string
          subject: string
          title: string
          updated_at?: string | null
          user_id?: string | null
          year: string
          youtube_url?: string | null
        }
        Update: {
          content?: string
          contributor_name?: string | null
          created_at?: string | null
          department?: string
          id?: string
          lecture_id?: string | null
          lecture_key?: string | null
          pdf_url?: string | null
          status?: string
          subject?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
          year?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summaries_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "subject_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_access_codes: {
        Row: {
          access_key: string
          created_at: string | null
          expires_at: string
          id: string
          max_uses: number | null
          used_count: number | null
        }
        Insert: {
          access_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          max_uses?: number | null
          used_count?: number | null
        }
        Update: {
          access_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          request_id: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
          request_id?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          request_id?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      tracked_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          destination_url: string
          id: string
          is_active: boolean | null
          slug: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          destination_url: string
          id?: string
          is_active?: boolean | null
          slug: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          destination_url?: string
          id?: string
          is_active?: boolean | null
          slug?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_access_code_redemptions: {
        Row: {
          code_id: string
          id: string
          membership_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          membership_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          membership_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trw_access_code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "trw_access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_access_code_redemptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "trw_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_access_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_access_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_access_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          membership_duration_days: number | null
          plan_id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          membership_duration_days?: number | null
          plan_id: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          membership_duration_days?: number | null
          plan_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trw_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_access_codes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trw_plan_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_categories: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_published: boolean
          metadata: Json
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_published?: boolean
          metadata?: Json
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_published?: boolean
          metadata?: Json
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      trw_membership_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          id: string
          membership_id: string | null
          notes: string | null
          occurred_at: string
          plan_slug: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          occurred_at?: string
          plan_slug: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          occurred_at?: string
          plan_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trw_membership_audit_log_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "trw_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_memberships: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          plan_id: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trw_memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trw_plan_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_plan_category_access: {
        Row: {
          category_id: string
          id: string
          plan_id: string
        }
        Insert: {
          category_id: string
          id?: string
          plan_id: string
        }
        Update: {
          category_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trw_plan_category_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "trw_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_plan_category_access_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trw_plan_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      trw_plan_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      trw_user_progress: {
        Row: {
          completed_at: string
          id: string
          material_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          material_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          material_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trw_user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trw_user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string | null
          id: string
          language: string | null
          lecture_id: string | null
          lecture_key: string | null
          subject: string
          title: string
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string | null
          lecture_id?: string | null
          lecture_key?: string | null
          subject: string
          title: string
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string | null
          lecture_id?: string | null
          lecture_key?: string | null
          subject?: string
          title?: string
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "subject_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lectures_with_ratings: {
        Row: {
          avg_rating: number | null
          created_at: string | null
          id: string | null
          language: string | null
          lecture_id: string | null
          lecture_key: string | null
          reviews_count: number | null
          subject: string | null
          title: string | null
          url: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "subject_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes_with_ratings: {
        Row: {
          avg_rating: number | null
          created_at: string | null
          department: string | null
          description: string | null
          id: string | null
          reviews_count: number | null
          source_type: string | null
          status: string | null
          subject: string | null
          summary_id: string | null
          title: string | null
          user_id: string | null
          year: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_details: {
        Row: {
          comment: string | null
          course_id: string | null
          created_at: string | null
          id: string | null
          quiz_id: string | null
          rating: number | null
          reviewer_avatar: string | null
          reviewer_name: string | null
          summary_id: string | null
          user_id: string | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "lectures_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries_with_ratings: {
        Row: {
          avg_rating: number | null
          content: string | null
          contributor_name: string | null
          created_at: string | null
          department: string | null
          id: string | null
          pdf_url: string | null
          reviews_count: number | null
          status: string | null
          subject: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          year: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: never
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: never
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
          role?: never
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string | null
          role?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_migrate_student_semesters: {
        Args: { p_overwrite_manual?: boolean; p_target_semester: number }
        Returns: number
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      delete_all_analytics: { Args: never; Returns: undefined }
      delete_old_ai_chat_messages: { Args: never; Returns: undefined }
      delete_old_analytics: { Args: never; Returns: undefined }
      finish_quiz_attempt: {
        Args: { p_attempt_id: string; p_time_taken_seconds?: number }
        Returns: Json
      }
      get_admin_analytics_summary: { Args: never; Returns: Json }
      get_content_analytics_internal: {
        Args: never
        Returns: {
          clicks_count: number
          content_id: string
          content_type: string
          last_updated: string
          unique_views_count: number
          views_count: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_trw_member: { Args: never; Returns: boolean }
      is_trw_member_for_category: {
        Args: { p_category_id: string }
        Returns: boolean
      }
      manual_ai_summarization: { Args: { chat_uuid: string }; Returns: string }
      notify_admins_of_content: {
        Args: {
          p_message: string
          p_related_id: string
          p_related_type: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      redeem_system_access_code: {
        Args: { p_access_key: string }
        Returns: Json
      }
      set_user_role: {
        Args: { new_role: string; user_id: string }
        Returns: undefined
      }
      trw_redeem_access_code: { Args: { p_code: string }; Returns: Json }
      update_user_display_name: {
        Args: { display_name: string; user_id: string }
        Returns: boolean
      }
      verify_system_access_code: {
        Args: { p_access_key: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
