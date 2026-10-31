-- ============================================================================
-- BASELINE — full schema snapshot of production (Supabase project
-- jcufigozkhxazjbwhjjm), generated 2026-10-31.
--
-- HOW THIS WAS PRODUCED
--   Not hand-written and not pg_dump: this file is generated from the
--   production catalogs (pg_catalog / information_schema introspection —
--   pg_get_functiondef, pg_get_triggerdef, pg_get_constraintdef,
--   pg_get_indexdef, pg_get_viewdef, pg_policies, ACL catalogs) through the
--   generator scripts committed alongside this migration in
--   specs/031-migration-consolidation/tools/. The rebuild is verified by
--   applying this file to a fresh PostgreSQL 17 and diffing the introspection
--   output against production (see specs/031-migration-consolidation/verification.md).
--
-- WHAT IS INCLUDED
--   public + storage schemas: tables, columns, inline constraints (PK/UNIQUE/
--   CHECK), foreign keys, indexes, views, functions (incl. SECURITY DEFINER
--   and SET search_path), triggers, RLS policies, ACL grants.
--   Storage bucket rows are data, not schema — see the following
--   *_storage_buckets migration.
--
-- DOCUMENTED DIVERGENCES (platform-owned, not app-owned)
--   * auth / realtime / supabase_functions / vault schemas are managed by the
--     Supabase platform and are intentionally NOT captured.
--   * pg_net and supabase_vault extensions are Supabase-only: their CREATE
--     EXTENSION is attempted but tolerated to fail outside Supabase.
--   * pg_stat_statements requires shared_preload_libraries; tolerated to fail.
--   * Default ACLs are documented as comments (platform-managed).
--   * Grant options (WITH GRANT OPTION) are not reproduced.
--
-- RULES (see supabase/migrations/README.md)
--   * The migration chain is APPEND-ONLY from this point on.
--   * NEVER edit this file or any migration that was applied to production.
--   * New migrations: timestamp-prefixed files whose prefix matches the
--     version recorded in the production migration ledger.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS storage;

-- ===== extensions =====
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto;            EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip pgcrypto: %', SQLERRM; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS "uuid-ossp";         EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip uuid-ossp: %', SQLERRM; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip pg_stat_statements: %', SQLERRM; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_net;              EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip pg_net (supabase-only): %', SQLERRM; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS supabase_vault;      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip supabase_vault (supabase-only): %', SQLERRM; END $$;

-- ===== types =====
CREATE TYPE storage.buckettype AS ENUM ('STANDARD', 'ANALYTICS', 'VECTOR');

-- ===== tables =====
CREATE TABLE storage.buckets (
  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text,
  type storage.buckettype NOT NULL DEFAULT 'STANDARD'::storage.buckettype,
  versioning_status text NOT NULL DEFAULT 'DISABLED'::text,
  lifecycle_configuration jsonb,
  lifecycle_configuration_generation uuid,
  CONSTRAINT buckets_pkey PRIMARY KEY (id),
  CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text]))),
  CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
  CONSTRAINT buckets_versioning_dark_check CHECK ((versioning_status = 'DISABLED'::text)),
  CONSTRAINT buckets_lifecycle_configuration_pair_check CHECK (((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL))),
  CONSTRAINT buckets_lifecycle_configuration_shape_check CHECK (((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = 'object'::text) AND (lifecycle_configuration ? 'rules'::text) AND
CASE
    WHEN (jsonb_typeof((lifecycle_configuration -> 'rules'::text)) = 'array'::text) THEN ((jsonb_array_length((lifecycle_configuration -> 'rules'::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> 'rules'::text)) <= 1000))
    ELSE false
END))),
  CONSTRAINT buckets_lifecycle_configuration_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL))))
);
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
  version text,
  owner_id text,
  user_metadata jsonb,
  archived_at timestamp with time zone,
  is_delete_marker boolean NOT NULL DEFAULT false,
  is_versioned boolean NOT NULL DEFAULT false,
  CONSTRAINT objects_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.migrations (
  id integer NOT NULL,
  name character varying(100) NOT NULL,
  hash character varying(40) NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT migrations_pkey PRIMARY KEY (id),
  CONSTRAINT migrations_name_key UNIQUE (name)
);
ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.s3_multipart_uploads (
  id text NOT NULL,
  in_progress_size bigint NOT NULL DEFAULT 0,
  upload_signature text NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  owner_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_metadata jsonb,
  metadata jsonb,
  CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.s3_multipart_uploads_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_id text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  part_number integer NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  etag text NOT NULL,
  owner_id text,
  version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.buckets_analytics (
  name text NOT NULL,
  type storage.buckettype NOT NULL DEFAULT 'ANALYTICS'::storage.buckettype,
  format text NOT NULL DEFAULT 'ICEBERG'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamp with time zone,
  CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.buckets_vectors (
  id text NOT NULL,
  type storage.buckettype NOT NULL DEFAULT 'VECTOR'::storage.buckettype,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.vector_indexes (
  id text NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bucket_id text NOT NULL,
  data_type text NOT NULL,
  dimension integer NOT NULL,
  distance_metric text NOT NULL,
  metadata_configuration jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vector_indexes_pkey PRIMARY KEY (id)
);
ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL,
  year text NOT NULL,
  department text NOT NULL,
  content text NOT NULL,
  pdf_url text,
  contributor_name text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  lecture_key text,
  lecture_id uuid,
  youtube_url text,
  CONSTRAINT summaries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT summaries_pkey PRIMARY KEY (id)
);
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.news (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'announcement'::text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  subject text,
  department text,
  year text,
  custom_category text,
  file_url text,
  image_urls text[],
  CONSTRAINT news_type_check CHECK ((type = ANY (ARRAY['announcement'::text, 'update'::text, 'important'::text]))),
  CONSTRAINT news_pkey PRIMARY KEY (id)
);
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.appeals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL,
  content_type text NOT NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  content_title text,
  reviewed_by uuid,
  CONSTRAINT appeals_content_type_check CHECK ((content_type = ANY (ARRAY['summary'::text, 'news'::text]))),
  CONSTRAINT appeals_pkey PRIMARY KEY (id)
);
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admins (
  user_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone DEFAULT now(),
  notes text,
  role text DEFAULT 'student'::text,
  CONSTRAINT admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT admins_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'doctor'::text, 'student_admin'::text])))
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  type text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chats_type_check CHECK ((type = ANY (ARRAY['individual'::text, 'group'::text]))),
  CONSTRAINT chats_pkey PRIMARY KEY (id)
);
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_participants (
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id)
);
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid,
  summary_content text,
  important_messages jsonb,
  last_message_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_summaries_pkey PRIMARY KEY (id)
);
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  related_id uuid,
  related_type text,
  read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['admin_submission'::text, 'content_published'::text, 'system'::text]))),
  CONSTRAINT notifications_related_type_check CHECK ((related_type = ANY (ARRAY['summary'::text, 'news'::text, 'appeal'::text]))),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  content_type text NOT NULL,
  content_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT analytics_pkey PRIMARY KEY (id)
);
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assistant_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  user_message text NOT NULL,
  assistant_response text NOT NULL,
  response_time_ms integer,
  ai_model_used text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assistant_messages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.content_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id text NOT NULL,
  views_count integer DEFAULT 0,
  clicks_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  unique_views_count integer DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT content_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT content_analytics_content_type_content_id_key UNIQUE (content_type, content_id)
);
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exhausted_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  user_id uuid,
  exhausted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exhausted_api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT exhausted_api_keys_api_key_user_id_key UNIQUE (api_key, user_id)
);
ALTER TABLE public.exhausted_api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  message text NOT NULL,
  status_code integer,
  request_id text,
  endpoint text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  user_id uuid,
  source_type text DEFAULT 'ai_generated'::text,
  created_at timestamp with time zone DEFAULT now(),
  summary_id uuid,
  subject text,
  department text,
  year text,
  status text NOT NULL DEFAULT 'pending'::text,
  duration_seconds integer,
  lecture_key text,
  lecture_id uuid,
  created_by uuid,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer integer NOT NULL,
  explanation text,
  order_index integer DEFAULT 0,
  image_url text,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  user_id uuid,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  answers jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  time_taken_seconds integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.password_reset_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  token text,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  token_hash text NOT NULL,
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_token_key UNIQUE (token)
);
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  username text,
  full_name text,
  avatar_url text,
  website text,
  display_name text,
  level integer,
  semester integer,
  department_id uuid,
  show_extra_assets boolean DEFAULT false,
  show_extra_assets_updated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  semester_manually_set boolean NOT NULL DEFAULT false,
  semester_updated_at timestamp with time zone,
  extra_assets_entitled boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_level_range CHECK (((level IS NULL) OR ((level >= 1) AND (level <= 10)))),
  CONSTRAINT profiles_semester_range CHECK (((semester IS NULL) OR ((semester >= 1) AND (semester <= 3))))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid,
  summary_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rating integer NOT NULL DEFAULT 5,
  quiz_id uuid,
  course_id uuid,
  video_id uuid,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  show_on_home boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  semester integer DEFAULT 1,
  level integer,
  schedule text,
  location text,
  description text,
  professor text,
  status text DEFAULT 'approved'::text,
  is_academic boolean DEFAULT true,
  name_en text,
  professor_gender text DEFAULT 'male'::text,
  description_ar text,
  professor_ar text,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_name_key UNIQUE (name),
  CONSTRAINT subjects_level_range CHECK (((level IS NULL) OR ((level >= 1) AND (level <= 4)))),
  CONSTRAINT subjects_professor_gender_check CHECK ((professor_gender = ANY (ARRAY['male'::text, 'female'::text])))
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_id uuid NOT NULL,
  price numeric,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id)
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  payment_screenshot_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_student_id_course_id_key UNIQUE (student_id, course_id),
  CONSTRAINT enrollments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'rejected'::text, 'cancelled'::text])))
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_files_pkey PRIMARY KEY (id)
);
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_summaries_pkey PRIMARY KEY (id)
);
ALTER TABLE public.course_summaries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  language text NOT NULL,
  duration integer,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_videos_language_check CHECK ((language = ANY (ARRAY['ar'::text, 'en'::text]))),
  CONSTRAINT course_videos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  user_id uuid,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  changed_data jsonb NOT NULL,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_option integer,
  is_correct boolean,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_answers_attempt_question_unique UNIQUE (attempt_id, question_id)
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_settings (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (key)
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  language text,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  lecture_key text,
  lecture_id uuid,
  CONSTRAINT videos_language_check CHECK ((language = ANY (ARRAY['ar'::text, 'en'::text]))),
  CONSTRAINT videos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL,
  description text,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  lecture_key text,
  lecture_id uuid,
  CONSTRAINT files_pkey PRIMARY KEY (id)
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subject_lectures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  lecture_key text NOT NULL,
  lecture_label text NOT NULL,
  order_index integer NOT NULL DEFAULT 999999,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subject_lectures_pkey PRIMARY KEY (id),
  CONSTRAINT subject_lectures_subject_lecture_key_key UNIQUE (subject, lecture_key)
);
ALTER TABLE public.subject_lectures ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  content_id text NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_progress_user_id_content_id_key UNIQUE (user_id, content_id)
);
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.academic_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_number integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_levels_pkey PRIMARY KEY (id),
  CONSTRAINT academic_levels_name_key UNIQUE (name),
  CONSTRAINT academic_levels_level_number_key UNIQUE (level_number)
);
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_level_id uuid,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_name_key UNIQUE (name)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_access_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  access_key text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  CONSTRAINT usage_limit_check CHECK ((used_count <= max_uses)),
  CONSTRAINT system_access_codes_pkey PRIMARY KEY (id),
  CONSTRAINT system_access_codes_access_key_key UNIQUE (access_key)
);
ALTER TABLE public.system_access_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_plan_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_plan_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT trw_plan_definitions_slug_key UNIQUE (slug)
);
ALTER TABLE public.trw_plan_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon_name text,
  cover_url text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_categories_pkey PRIMARY KEY (id),
  CONSTRAINT trw_categories_slug_key UNIQUE (slug)
);
ALTER TABLE public.trw_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_plan_category_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT trw_plan_category_access_pkey PRIMARY KEY (id),
  CONSTRAINT trw_plan_category_access_plan_id_category_id_key UNIQUE (plan_id, category_id)
);
ALTER TABLE public.trw_plan_category_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  notes text,
  CONSTRAINT trw_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT trw_memberships_user_id_plan_id_key UNIQUE (user_id, plan_id)
);
ALTER TABLE public.trw_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_membership_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  membership_id uuid,
  user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  plan_slug text NOT NULL,
  notes text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_membership_audit_log_action_check CHECK ((action = ANY (ARRAY['granted'::text, 'revoked'::text, 'expired'::text, 'renewed'::text]))),
  CONSTRAINT trw_membership_audit_log_pkey PRIMARY KEY (id)
);
ALTER TABLE public.trw_membership_audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_access_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  plan_id uuid NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  membership_duration_days integer,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_access_codes_check CHECK ((used_count <= max_uses)),
  CONSTRAINT no_exhausted_active CHECK ((NOT ((used_count >= max_uses) AND (is_active = true)))),
  CONSTRAINT trw_access_codes_pkey PRIMARY KEY (id),
  CONSTRAINT trw_access_codes_code_key UNIQUE (code)
);
ALTER TABLE public.trw_access_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_access_code_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_id uuid,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_access_code_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT trw_access_code_redemptions_code_id_user_id_key UNIQUE (code_id, user_id)
);
ALTER TABLE public.trw_access_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trw_user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trw_user_progress_pkey PRIMARY KEY (id),
  CONSTRAINT trw_user_progress_user_id_material_id_key UNIQUE (user_id, material_id)
);
ALTER TABLE public.trw_user_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  mode text NOT NULL DEFAULT 'cs_assistant'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text]))),
  CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_chat_messages_mode_check CHECK ((mode = ANY (ARRAY['cs_assistant'::text, 'student_agent'::text, 'group_rag'::text])))
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tracked_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  destination_url text NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  is_active boolean DEFAULT true,
  CONSTRAINT tracked_links_pkey PRIMARY KEY (id),
  CONSTRAINT tracked_links_slug_key UNIQUE (slug)
);
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.link_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  link_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  ip_address text,
  ip_hash text,
  city text,
  country text,
  region text,
  postal_code text,
  timezone text,
  user_agent text,
  referrer text,
  device_type text,
  CONSTRAINT link_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.link_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_check CHECK (((email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text) AND (char_length(email) <= 254))),
  CONSTRAINT waitlist_source_check CHECK ((source = ANY (ARRAY['trw'::text, 'macos'::text, 'android'::text]))),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- ===== fks =====
ALTER TABLE storage.objects ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
ALTER TABLE storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;
ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
ALTER TABLE storage.vector_indexes ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);
ALTER TABLE public.messages ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
ALTER TABLE public.ai_summaries ADD CONSTRAINT ai_summaries_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
ALTER TABLE public.ai_summaries ADD CONSTRAINT ai_summaries_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES messages(id);
ALTER TABLE public.exhausted_api_keys ADD CONSTRAINT exhausted_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.analytics ADD CONSTRAINT analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.assistant_messages ADD CONSTRAINT assistant_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chats ADD CONSTRAINT chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.news ADD CONSTRAINT news_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.appeals ADD CONSTRAINT appeals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.appeals ADD CONSTRAINT appeals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.admins ADD CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.summaries ADD CONSTRAINT summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_summary_id_fkey FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD CONSTRAINT comments_summary_id_fkey FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.courses ADD CONSTRAINT courses_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.course_files ADD CONSTRAINT course_files_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public.course_summaries ADD CONSTRAINT course_summaries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public.course_videos ADD CONSTRAINT course_videos_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_answers ADD CONSTRAINT quiz_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public.videos ADD CONSTRAINT videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.files ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD CONSTRAINT departments_academic_level_id_fkey FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE public.trw_plan_category_access ADD CONSTRAINT trw_plan_category_access_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trw_plan_definitions(id) ON DELETE CASCADE;
ALTER TABLE public.trw_plan_category_access ADD CONSTRAINT trw_plan_category_access_category_id_fkey FOREIGN KEY (category_id) REFERENCES trw_categories(id) ON DELETE CASCADE;
ALTER TABLE public.trw_memberships ADD CONSTRAINT trw_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trw_memberships ADD CONSTRAINT trw_memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trw_plan_definitions(id) ON DELETE RESTRICT;
ALTER TABLE public.trw_memberships ADD CONSTRAINT trw_memberships_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trw_memberships ADD CONSTRAINT trw_memberships_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trw_membership_audit_log ADD CONSTRAINT trw_membership_audit_log_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES trw_memberships(id) ON DELETE SET NULL;
ALTER TABLE public.trw_access_codes ADD CONSTRAINT trw_access_codes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trw_plan_definitions(id) ON DELETE RESTRICT;
ALTER TABLE public.trw_access_codes ADD CONSTRAINT trw_access_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trw_access_code_redemptions ADD CONSTRAINT trw_access_code_redemptions_code_id_fkey FOREIGN KEY (code_id) REFERENCES trw_access_codes(id) ON DELETE RESTRICT;
ALTER TABLE public.trw_access_code_redemptions ADD CONSTRAINT trw_access_code_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trw_access_code_redemptions ADD CONSTRAINT trw_access_code_redemptions_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES trw_memberships(id) ON DELETE SET NULL;
ALTER TABLE public.trw_user_progress ADD CONSTRAINT trw_user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public.ai_chat_messages ADD CONSTRAINT ai_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.videos ADD CONSTRAINT videos_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES subject_lectures(id) ON DELETE SET NULL;
ALTER TABLE public.summaries ADD CONSTRAINT summaries_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES subject_lectures(id) ON DELETE SET NULL;
ALTER TABLE public.files ADD CONSTRAINT files_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES subject_lectures(id) ON DELETE SET NULL;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES subject_lectures(id) ON DELETE SET NULL;
ALTER TABLE public.tracked_links ADD CONSTRAINT tracked_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.link_logs ADD CONSTRAINT link_logs_link_id_fkey FOREIGN KEY (link_id) REFERENCES tracked_links(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ===== functions =====
CREATE OR REPLACE FUNCTION storage.foldername(name text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$function$
;

CREATE OR REPLACE FUNCTION storage.filename(name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$function$
;

CREATE OR REPLACE FUNCTION storage.extension(name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$function$
;

CREATE OR REPLACE FUNCTION storage.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$function$
;

CREATE OR REPLACE FUNCTION storage.operation()
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.enforce_bucket_name_length()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_role(user_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_display_name(user_id uuid, display_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only allow users to update their own display name
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'You can only update your own display name';
  END IF;

  -- Update the display name in user metadata
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', display_name)
  WHERE id = user_id;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_chats_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_ai_summaries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_chat_ai_summarization()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  message_count INTEGER;
BEGIN
  -- Count messages in the chat
  SELECT COUNT(*) INTO message_count
  FROM messages
  WHERE chat_id = NEW.chat_id;

  -- Trigger AI summarization every 10 messages or when explicitly requested
  IF message_count % 10 = 0 THEN
    -- Call the Edge Function asynchronously
    -- Note: This would need to be implemented with pg_net or similar
    -- For now, we'll log that summarization should be triggered
    RAISE LOG 'AI summarization triggered for chat % with % messages', NEW.chat_id, message_count;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.manual_ai_summarization(chat_uuid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result TEXT;
BEGIN
  -- This function can be called to manually trigger AI summarization
  -- In a real implementation, this would call the Edge Function
  SELECT 'AI summarization manually triggered for chat ' || chat_uuid::TEXT INTO result;
  RAISE LOG '%', result;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    result pg_catalog.json;
    total_users_count integer;
    total_messages_count integer;
    total_views_count integer;
    total_clicks_count integer;
    top_content_data pg_catalog.json;
    recent_activity_data pg_catalog.json;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- Active users: login or relevant activity within the last 30 days.
    SELECT count(DISTINCT u.id)
    INTO total_users_count
    FROM auth.users u
    LEFT JOIN public.analytics a ON u.id = a.user_id
    WHERE (a.action_type = 'user_login' AND a.created_at >= now() - interval '30 days')
       OR (a.created_at >= now() - interval '30 days' AND a.action_type IN ('summary_view', 'summary_click', 'ai_interaction', 'content_view', 'link_click'));

    -- Assistant messages: the live chat persistence table (009). role='assistant'
    -- excludes the mirrored user-side rows so the card counts what its label says.
    SELECT count(*)
    INTO total_messages_count
    FROM public.ai_chat_messages
    WHERE role = 'assistant';

    -- Views: content_view was the intended event but the client only ever
    -- wrote page_view (verified on prod 2026-10-21: 0 content_view rows
    -- ever, 1,700+ page_view rows). Count both.
    SELECT count(*)
    INTO total_views_count
    FROM public.analytics
    WHERE action_type IN ('content_view', 'page_view');

    SELECT count(*)
    INTO total_clicks_count
    FROM public.analytics
    WHERE action_type IN ('summary_click', 'link_click');

    SELECT pg_catalog.json_agg(
        pg_catalog.json_build_object(
            'type', content_type,
            'count', view_count
        )
    )
    INTO top_content_data
    FROM (
        SELECT
            content_type,
            count(*) AS view_count
        FROM public.analytics
        WHERE action_type IN ('content_view', 'page_view')
        GROUP BY content_type
        ORDER BY view_count DESC
        LIMIT 10
    ) top_content;

    -- RAW action_type (client translates via i18n) + user_id (client's
    -- active-users trend needs it). Window of 100 feeds the 7d/prev-7d math.
    SELECT pg_catalog.json_agg(
        pg_catalog.json_build_object(
            'action', action_type,
            'content_type', content_type,
            'created_at', created_at::text,
            'user_id', user_id::text
        )
    )
    INTO recent_activity_data
    FROM (
        SELECT
            action_type,
            content_type,
            created_at,
            user_id
        FROM public.analytics
        WHERE action_type NOT IN ('user_login', 'user_logout')
        ORDER BY created_at DESC
        LIMIT 100
    ) recent;

    result := pg_catalog.json_build_object(
        'totalUsers', coalesce(total_users_count, 0),
        'totalMessages', coalesce(total_messages_count, 0),
        'totalViews', coalesce(total_views_count, 0),
        'totalClicks', coalesce(total_clicks_count, 0),
        'topContentTypes', coalesce(top_content_data, '[]'::pg_catalog.json),
        'recentActivity', coalesce(recent_activity_data, '[]'::pg_catalog.json)
    );

    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, semester, semester_manually_set)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((
      SELECT (value->>'semester')::int
      FROM public.platform_settings
      WHERE key = 'default_semester'
    ), 1),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_content_analytics_internal()
 RETURNS TABLE(content_id text, content_type text, views_count bigint, clicks_count bigint, unique_views_count bigint, last_updated timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    RETURN QUERY
    SELECT
        a.content_id,
        a.content_type,
        count(*) FILTER (WHERE a.action_type = 'content_view') AS views_count,
        count(*) FILTER (WHERE a.action_type = 'summary_click') AS clicks_count,
        count(DISTINCT a.metadata->>'session_id') FILTER (WHERE a.action_type = 'content_view') AS unique_views_count,
        max(a.created_at) AS last_updated
    FROM public.analytics AS a
    GROUP BY a.content_id, a.content_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', profiles.display_name),
    avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', profiles.avatar_url),
    updated_at = now();
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enable_rls_on_new_table()
 RETURNS event_trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' LOOP
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_table_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    operation_type text;
    current_user_id uuid;
BEGIN
    operation_type := TG_OP;
    current_user_id := auth.uid();

    -- Only audit if we have a user context, or if it's a system-level change
    -- we want to track (user_id will be NULL for system changes)
    
    INSERT INTO public.audit_logs (
        operation_name,
        user_id,
        changed_data
    ) VALUES (
        TG_TABLE_NAME || '_' || operation_type,
        current_user_id, -- This can now be NULL for system-level changes
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'old_data', CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            'new_data', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
            'timestamp', NOW(),
            'triggered_by_system', current_user_id IS NULL
        )
    );

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
SELECT CASE
    WHEN p_delimiter <> ''
         AND position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(
        p_key,
        length(p_prefix)
            + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1))
            + length(p_delimiter) - 1
    )
    ELSE NULL
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.protect_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.delete_all_analytics()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Delete all records
    DELETE FROM public.analytics;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_old_analytics()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Delete records older than 10 days (you can adjust the number as needed)
    DELETE FROM public.analytics
    WHERE created_at < NOW() - INTERVAL '10 days';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_show_extra_assets_cooldown()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  cooldown_interval interval := interval '2 hours';
BEGIN
  -- Only enforce when the value is actually changing
  IF NEW.show_extra_assets IS DISTINCT FROM OLD.show_extra_assets THEN
    IF OLD.show_extra_assets_updated_at IS NOT NULL
       AND (now() - OLD.show_extra_assets_updated_at) < cooldown_interval THEN
      RAISE EXCEPTION 'Cooldown active. You can change this setting once every 2 hours.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Always write the timestamp from the database server clock
    NEW.show_extra_assets_updated_at := now();
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_trw_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.trw_memberships
    WHERE user_id   = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_trw_member_for_category(p_category_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.trw_memberships m
    JOIN public.trw_plan_category_access pca ON pca.plan_id = m.plan_id
    WHERE m.user_id    = auth.uid()
      AND m.revoked_at IS NULL
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND pca.category_id = p_category_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.trw_redeem_access_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code        public.trw_access_codes%ROWTYPE;
  v_plan        public.trw_plan_definitions%ROWTYPE;
  v_user_id     UUID := auth.uid();
  v_expires_at  TIMESTAMPTZ;
  v_membership  public.trw_memberships%ROWTYPE;
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock + fetch the code atomically
  SELECT * INTO v_code
  FROM public.trw_access_codes
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  -- Check for duplicate redemption
  IF EXISTS (
    SELECT 1 FROM public.trw_access_code_redemptions
    WHERE code_id = v_code.id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Compute membership expiry
  v_expires_at := CASE
    WHEN v_code.membership_duration_days IS NOT NULL
      THEN now() + (v_code.membership_duration_days || ' days')::INTERVAL
    ELSE NULL  -- Permanent
  END;

  -- Fetch plan
  SELECT * INTO v_plan FROM public.trw_plan_definitions WHERE id = v_code.plan_id;

  -- Upsert membership
  INSERT INTO public.trw_memberships (user_id, plan_id, granted_by, expires_at, notes)
  VALUES (v_user_id, v_code.plan_id, NULL, v_expires_at, 'Redeemed via code: ' || p_code)
  ON CONFLICT (user_id, plan_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        revoked_at = NULL,
        granted_at = now(),
        notes      = EXCLUDED.notes
  RETURNING * INTO v_membership;

  -- Record redemption
  INSERT INTO public.trw_access_code_redemptions (code_id, user_id, membership_id)
  VALUES (v_code.id, v_user_id, v_membership.id);

  -- Increment usage counter
  UPDATE public.trw_access_codes SET used_count = used_count + 1 WHERE id = v_code.id;

  -- Deactivate code if exhausted
  UPDATE public.trw_access_codes
  SET is_active = false
  WHERE id = v_code.id AND used_count >= max_uses;

  -- Write audit log
  INSERT INTO public.trw_membership_audit_log
    (membership_id, user_id, actor_id, action, plan_slug, notes)
  VALUES
    (v_membership.id, v_user_id, NULL, 'granted', v_plan.slug, 'Code redemption');

  RETURN jsonb_build_object(
    'success',    true,
    'plan_slug',  v_plan.slug,
    'expires_at', v_expires_at
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_old_ai_chat_messages()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Delete messages older than 30 days
    DELETE FROM public.ai_chat_messages
    WHERE created_at < now() - interval '30 days';
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.allow_only_operation(expected_operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$function$
;

CREATE OR REPLACE FUNCTION storage.allow_any_operation(expected_operations text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$function$
;

CREATE OR REPLACE FUNCTION public.summaries_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT COALESCE(public.is_admin(), false)
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Only admins can change summary status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_system_access_code(p_access_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_used int;
  v_max  int;
BEGIN
  SELECT used_count, max_uses INTO v_used, v_max
    FROM public.system_access_codes
   WHERE access_key = p_access_key
     AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  IF v_used >= v_max THEN
    RETURN 'exhausted';
  END IF;

  UPDATE public.system_access_codes
     SET used_count = used_count + 1
   WHERE access_key = p_access_key
     AND expires_at > now();

  RETURN 'valid';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_of_content(p_type text, p_related_type text, p_related_id uuid, p_title text, p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF p_type NOT IN ('admin_submission', 'content_published', 'system')
     OR p_related_type NOT IN ('summary', 'news') THEN
    RAISE EXCEPTION 'Invalid notification type or related_type'
      USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 200
     OR p_message IS NULL OR char_length(btrim(p_message)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid notification content length'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    (
      EXISTS (
        SELECT 1 FROM public.appeals
         WHERE created_by = auth.uid()
           AND content_id = p_related_id
           AND content_type = p_related_type
      )
      OR (
        COALESCE(public.is_admin(), false)
        AND (
          (p_related_type = 'summary'
            AND EXISTS (SELECT 1 FROM public.summaries WHERE id = p_related_id))
          OR
          (p_related_type = 'news'
            AND EXISTS (SELECT 1 FROM public.news WHERE id = p_related_id))
        )
      )
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed to notify admins about this content'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications
    (user_id, title, message, type, related_id, related_type, read)
  SELECT a.user_id, p_title, p_message, p_type, p_related_id, p_related_type, false
    FROM public.admins a;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_user_role_from_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
  WHERE id = OLD.user_id;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_target_semester NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_semester';
  END IF;

  UPDATE public.profiles
     SET semester = p_target_semester,
         semester_manually_set = false,
         semester_updated_at = now()
   WHERE (COALESCE(NOT semester_manually_set, true) OR p_overwrite_manual)
     AND NOT EXISTS (
       SELECT 1 FROM public.admins WHERE admins.user_id = profiles.id
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('default_semester', jsonb_build_object('semester', p_target_semester), now())
  ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now();

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer DEFAULT 10, p_window_minutes integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_count integer; window_cutoff timestamptz;
begin
  window_cutoff := now() - make_interval(mins => p_window_minutes);
  delete from public.rate_limits
   where identifier = p_identifier and endpoint = p_endpoint
     and window_start < window_cutoff;
  select coalesce(request_count, 0) into current_count from public.rate_limits
   where identifier = p_identifier and endpoint = p_endpoint
     and window_start >= window_cutoff;
  if current_count >= p_max_requests then return false; end if;
  insert into public.rate_limits (identifier, endpoint, request_count, window_start, updated_at)
  values (p_identifier, p_endpoint, 1, now(), now())
  on conflict (identifier, endpoint) do update
    set request_count = public.rate_limits.request_count + 1, updated_at = now()
    where public.rate_limits.window_start >= window_cutoff;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION storage.protect_bucket_control_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  configuration_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_configuration IS NOT NULL
       OR NEW.lifecycle_configuration_generation IS NOT NULL THEN
      IF NOT pg_has_role(current_user, TG_ARGV[0], 'MEMBER') THEN
        RAISE EXCEPTION 'only members of the configured storage service role may insert lifecycle policy state'
          USING ERRCODE = '42501',
                HINT = format(
                  'Insert with both lifecycle columns NULL and configure lifecycle through the Storage API afterward, or insert as a member of %I.',
                  TG_ARGV[0]
                );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  configuration_changed =
    OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
    OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation;

  IF NOT configuration_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'STANDARD' THEN
    RAISE EXCEPTION 'bucket versioning and lifecycle controls require a Standard bucket'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     AND NEW.lifecycle_configuration_generation IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     OR NEW.lifecycle_configuration_generation IS NULL
     OR OLD.lifecycle_configuration IS NOT DISTINCT FROM NEW.lifecycle_configuration
     OR OLD.lifecycle_configuration_generation IS NOT DISTINCT FROM NEW.lifecycle_configuration_generation THEN
    RAISE EXCEPTION 'a changed lifecycle policy requires a new non-null generation'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.enforce_bucket_lifecycle_service_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF current_user::text IS DISTINCT FROM TG_ARGV[0]
     AND (
       OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
       OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation
     ) THEN
    -- AFTER runs only after caller RLS has accepted the proposed row. The API
    -- recognizes this specific error after rolling back its permission probe;
    -- direct non-service writes still fail and cannot persist the change.
    RAISE EXCEPTION 'bucket control columns may only be changed by the configured storage service role'
      USING ERRCODE = 'PST01',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            CONSTRAINT = TG_NAME;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text, raw_prefix_param text DEFAULT NULL::text)
 RETURNS TABLE(key text, id text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
WITH candidates AS (
    SELECT
        upload.key AS object_key,
        CASE
            WHEN position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0
            THEN left(
                upload.key,
                length(coalesce($7, $2))
                    + position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1))
                    + length($3) - 1
            )
            ELSE upload.key
        END AS result_key,
        upload.id,
        upload.created_at,
        position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0 AS is_common_prefix
    FROM storage.s3_multipart_uploads AS upload
    WHERE upload.bucket_id = $1
      AND upload.key COLLATE "C" LIKE $2 || '%'
), filtered AS (
    SELECT candidate.*
    FROM candidates AS candidate
    WHERE $5 = ''
       OR candidate.result_key COLLATE "C" > $5
       OR (
           candidate.result_key COLLATE "C" = $5
           AND NOT candidate.is_common_prefix
           AND $6 <> ''
           -- A completed or aborted marker repeats the remaining same-key uploads.
           AND COALESCE(
               (candidate.created_at, candidate.id COLLATE "C") > (
                   SELECT marker.created_at, marker.id COLLATE "C"
                   FROM storage.s3_multipart_uploads AS marker
                   WHERE marker.bucket_id = $1
                     AND marker.key COLLATE "C" = $5
                     AND marker.id = $6
               ),
               TRUE
           )
       )
), ranked AS (
    SELECT
        filtered.*,
        row_number() OVER (
            PARTITION BY filtered.result_key COLLATE "C"
            ORDER BY filtered.created_at, filtered.id COLLATE "C"
        ) AS prefix_rank
    FROM filtered
)
SELECT ranked.result_key, ranked.id, ranked.created_at
FROM ranked
WHERE NOT ranked.is_common_prefix OR ranked.prefix_rank = 1
ORDER BY ranked.result_key COLLATE "C", ranked.created_at, ranked.id COLLATE "C"
LIMIT $4;
$function$
;

CREATE OR REPLACE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, next_token_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, next_token_version text DEFAULT ''::text)
 RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_start_relative TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;

    -- true when noncurrent_versions can return >1 row per name; keeps them
    -- ordered most-recent-first and lets pagination resume mid-key
    v_multi_row BOOLEAN;
    v_name_order TEXT;
    v_exact_range_predicate TEXT;
    v_strict_range_predicate TEXT;
    v_inclusive_range_predicate TEXT;

    -- Seek state for the current name. archived_at is normalized to JavaScript's
    -- millisecond precision and version breaks ties within the same millisecond.
    -- Current rows use 'infinity'; NULL means no tiebreak has been established.
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_cursor_is_folder BOOLEAN;
    v_count INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_batch_query_strict TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');
    v_name_order := CASE WHEN v_is_asc THEN 'ASC' ELSE 'DESC' END;

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Keep caller-provided cursors inside the requested prefix range.
    IF v_start <> '' AND v_upper_bound IS NOT NULL THEN
        IF v_is_asc THEN
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                v_start := '';
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                RETURN;
            END IF;
        ELSE
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                RETURN;
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                v_start := '';
            END IF;
        END IF;
    END IF;

    v_start_relative := substring(v_start FROM length(v_prefix) + 1);

    -- Direction affects only the indexed name range and its ordering. Cursor
    -- state transitions and within-key version ordering stay shared.
    IF v_is_asc THEN
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" > $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" >= $2';
        IF v_upper_bound IS NOT NULL THEN
            v_exact_range_predicate := 'o.name COLLATE "C" < $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" < $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" < $3';
        END IF;
    ELSE
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" < $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" < $2';
        IF v_prefix <> '' THEN
            v_exact_range_predicate := 'o.name COLLATE "C" >= $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" >= $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" >= $3';
        END IF;
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    -- The multi-row order matches the externally serialized cursor exactly:
    -- archived_at at millisecond precision, then version as the final tiebreak.
    --
    -- When v_multi_row, the seek is a keyset tuple comparison ("name > $2 OR
    -- (name = $2 AND tiebreak)") - Postgres won't split that OR into indexable
    -- form (confirmed even with fully literal values), so as one WHERE clause
    -- it forces a full bucket scan filtered row-by-row. Splitting it into two
    -- independently-indexable branches (exact name match with the tiebreak
    -- filter, vs. strictly-past names) combined with UNION ALL lets each
    -- branch keep name as a real index condition; the outer ORDER BY/LIMIT
    -- re-merges them into the same page the single query used to produce.
    IF v_multi_row THEN
        v_batch_query := format(
            $sql$
            SELECT *
            FROM (
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND o.name COLLATE "C" = $2
                      AND %s
                      AND NOT $7::boolean
                      AND (
                          $5::timestamptz IS NULL
                          OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < $5
                          OR (
                              COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = $5
                              AND COALESCE(o.version, '') > $6
                          )
                      )
                      %s
                    ORDER BY
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
                UNION ALL
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND %s
                      %s
                    ORDER BY
                        o.name COLLATE "C" %s,
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
            ) sub
            ORDER BY
                sub.name COLLATE "C" %s,
                COALESCE(date_trunc('milliseconds', sub.archived_at), 'infinity'::timestamptz) DESC,
                COALESCE(sub.version, '') ASC
            LIMIT $4
            $sql$,
            v_exact_range_predicate,
            v_version_filter,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order,
            v_name_order
        );
    ELSE
        v_batch_query := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_inclusive_range_predicate,
            v_version_filter,
            v_name_order
        );

        -- Strict counterpart of the query above: used once the single-row
        -- ASC batch advance (below) has left v_next_seek pointing at the
        -- last row already emitted, so an inclusive predicate would
        -- re-match it forever. Only single-row mode ever sets strict mode,
        -- so this variant is never needed when v_multi_row.
        v_batch_query_strict := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order
        );
    END IF;

    -- The static peek predicates cannot use the partial delete-marker index
    -- once PL/pgSQL switches to a generic plan because whether
    -- is_delete_marker is required remains parameter-dependent. Reuse the
    -- already-specialized batch query with a one-row limit for this sparse
    -- filter so the plan sees a literal `o.is_delete_marker` predicate.
    IF delete_markers = 'only' THEN
        v_delete_marker_peek_query :=
            'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        IF NOT v_multi_row THEN
            v_delete_marker_peek_query_strict :=
                'SELECT marker_page.name FROM (' || v_batch_query_strict || ') marker_page LIMIT 1';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor performs one specialized initial seek so
            -- partial current-version and delete-marker indexes remain available.
            EXECUTE format(
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY o.name COLLATE "C" DESC LIMIT 1',
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND o.name COLLATE "C" >= $2 AND o.name COLLATE "C" < $3'
                    ELSE ''
                END,
                v_version_filter
            )
            INTO v_next_seek
            USING _bucket_id, v_prefix, v_upper_bound;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Folder continuation tokens retain their trailing delimiter. A
        -- delimiter-less startAfter is always a literal key boundary.
        v_cursor_is_folder := delimiter_param <> ''
            AND v_start_relative <> ''
            AND right(v_start_relative, length(delimiter_param)) = delimiter_param;

        IF v_cursor_is_folder THEN
            v_next_seek := CASE
                WHEN right(v_start, length(delimiter_param)) = delimiter_param
                    THEN v_start
                ELSE v_start || delimiter_param
            END;
            IF v_is_asc THEN
                v_next_seek := left(v_next_seek, -1)
                    || chr(ascii(right(v_next_seek, 1)) + 1);
            END IF;
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- leaf object: when v_multi_row, stay on v_start with the
            -- caller-supplied tiebreak so a page boundary mid-key resumes
            -- that key's remaining rows instead of skipping them. Truncate
            -- to milliseconds like every other v_next_seek_at assignment -
            -- harmless today since object.ts's cursor always round-trips
            -- through JS Date first, but this shouldn't rely on that.
            IF v_multi_row THEN
                v_next_seek := v_start;
                v_next_seek_at := date_trunc('milliseconds', next_token_archived_at);
                v_next_seek_version := coalesce(next_token_version, '');
                v_next_seek_strict := coalesce(next_token, '') = '';
            ELSIF v_is_asc THEN
                v_next_seek := v_start;
                v_next_seek_strict := true;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        -- v_multi_row is branched here (rather than folded into the WHERE
        -- clause as a bound parameter) so each concrete query keeps an
        -- unconditional seek predicate - once PL/pgSQL switches to its
        -- cached generic plan (after 5 calls), a parameter-gated
        -- "(NOT v_multi_row AND name >= $x) OR (v_multi_row AND ...)"
        -- predicate stops the planner from using name as an index
        -- condition at all, degrading every subsequent peek to a full
        -- index scan filtered row-by-row instead of a bounded range scan.
        -- v_multi_row's seek predicate is a keyset tuple comparison
        -- ("name > x OR (name = x AND tiebreak)") - Postgres does not
        -- split this OR into indexable form even with fully literal
        -- values, so it falls back to a full scan filtered row-by-row.
        -- Splitting it into two independently-indexable branches (exact
        -- name match with the tiebreak filter, vs. strictly-past name)
        -- combined with UNION ALL lets each branch keep name as a real
        -- index condition; the outer ORDER BY/LIMIT picks whichever of
        -- the (at most 2) rows sorts first.
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING _bucket_id, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END,
                    1, v_next_seek_at, v_next_seek_version, v_next_seek_strict;
        ELSIF v_multi_row THEN
            IF v_is_asc THEN
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" < v_upper_bound
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek AND o.name COLLATE "C" < v_upper_bound
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" >= v_prefix
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        ELSE
            -- Single-row mode is always noncurrent_versions='exclude'. Keep
            -- this predicate literal so generic plans use the current index.
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.name COLLATE "C" >= v_prefix
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := v_common_prefix;
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            version := NULL;
            archived_at := NULL;
            is_delete_marker := NULL;
            is_versioned := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1)
                    || chr(ascii(right(v_common_prefix, 1)) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row THEN v_batch_query_strict ELSE v_batch_query END
                USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size, v_next_seek_at, v_next_seek_version,
                v_next_seek_strict
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN v_current.name
                        ELSE v_current.name || delimiter_param
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                version := v_current.version;
                archived_at := v_current.archived_at;
                is_delete_marker := v_current.is_delete_marker;
                is_versioned := v_current.is_versioned;
                RETURN NEXT;
                v_count := v_count + 1;

                -- when v_multi_row, stay on this name and record its
                -- archived_at as the new tiebreak so remaining rows for the
                -- same key are picked up before moving to the next name
                IF v_multi_row THEN
                    v_next_seek := v_current.name;
                    v_next_seek_at := COALESCE(date_trunc('milliseconds', v_current.archived_at), 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                    v_next_seek_strict := false;
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor
                    -- would skip a real key like `name || '!'` (or any
                    -- character sorting below the delimiter), which sorts
                    -- between `name` and `name || delimiter`. Track the real
                    -- name and mark the next comparison strict instead.
                    v_next_seek := v_current.name;
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.list_objects_with_delimiter made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text)
 RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;
    v_multi_row BOOLEAN;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_count INT := 0;
    v_skipped INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;
    v_previous_skipped INT;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                  AND ($7 != 'exclude' OR objects.archived_at IS NULL)
                  AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
                  AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
                  AND ($8 != 'only' OR objects.is_delete_marker)
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata,
                   NULL::text AS version,
                   NULL::timestamptz AS archived_at,
                   NULL::boolean AS is_delete_marker,
                   NULL::boolean AS is_versioned FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata,
                   version, archived_at, is_delete_marker, is_versioned
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
               AND ($7 != 'exclude' OR objects.archived_at IS NULL)
               AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
               AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
               AND ($8 != 'only' OR objects.is_delete_marker)
             -- name, then version, as tiebreaks so two versions of the same
             -- key tying on the sort column still sort deterministically
             ORDER BY %I %s, name COLLATE "C" %s, COALESCE(version, '') %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order, v_sort_order, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets, noncurrent_versions, delete_markers;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build a resume-safe batch query. The exact-name branch returns remaining
    -- versions after the current (archived_at, version) boundary; the strict
    -- name branch returns subsequent keys. UNION ALL keeps both predicates
    -- independently indexable.
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2 AND lower(o.name) COLLATE "C" < $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 AND lower(o.name) COLLATE "C" >= $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    END IF;

    -- Keep the delete-marker predicate literal so the cached generic
    -- plan can use idx_objects_delete_markers during the main-loop peek.
    IF delete_markers = 'only' THEN
        IF v_multi_row THEN
            v_delete_marker_peek_query :=
                'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        ELSIF v_is_asc THEN
            -- Two separate literal query strings, not one gated by a bound
            -- boolean: folding "$n AND op1 OR NOT $n AND op2" into a single
            -- query defeats the generic plan's ability to push either
            -- comparison into the index. Branching in PL/pgSQL control flow
            -- instead keeps each query's index condition intact.
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" >= $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
            -- Strict variant: used once the single-row ASC batch advance
            -- (below) has left v_next_seek pointing at the last row already
            -- emitted, so a plain >= would re-match it forever.
            v_delete_marker_peek_query_strict :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" > $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
        ELSE
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" < $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" >= $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC performs one specialized initial seek so partial current-version
        -- and delete-marker indexes remain available.
        EXECUTE format(
            'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1',
            CASE WHEN v_upper_bound IS NOT NULL
                THEN ' AND lower(o.name) COLLATE "C" >= $2 AND lower(o.name) COLLATE "C" < $3'
                ELSE ''
            END,
            v_version_filter
        )
        INTO v_peek_name
        USING bucketname, v_prefix_lower, v_upper_bound;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch and
    -- the delete-marker-only path
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;
        v_previous_skipped := v_skipped;

        -- STEP 1: PEEK
        v_peek_name := NULL;
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END,
                    1, v_next_seek_at, v_next_seek_version;
        ELSIF v_multi_row AND v_next_seek_at IS NOT NULL THEN
            SELECT o.name INTO v_peek_name
            FROM storage.objects o
            WHERE o.bucket_id = bucketname
              AND lower(o.name) COLLATE "C" = v_next_seek
              AND (COALESCE(o.archived_at, 'infinity'::timestamptz) < v_next_seek_at
                   OR (COALESCE(o.archived_at, 'infinity'::timestamptz) = v_next_seek_at
                       AND COALESCE(o.version, '') > v_next_seek_version))
              AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
              AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
              AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
              AND (delete_markers != 'only' OR o.is_delete_marker)
            ORDER BY COALESCE(o.archived_at, 'infinity'::timestamptz) DESC,
                     COALESCE(o.version, '') ASC
            LIMIT 1;

            -- The current key is exhausted. Clear its version boundary and
            -- make the following ASC name peek strict. Appending '/' is not a
            -- valid lexical successor because keys ending in characters such
            -- as '!' sort between the exhausted name and name || '/'.
            IF v_peek_name IS NULL THEN
                IF v_is_asc THEN
                    v_next_seek_strict := true;
                END IF;
                v_next_seek_at := NULL;
                v_next_seek_version := '';
            END IF;
        END IF;

        -- Single-row mode is always noncurrent_versions='exclude'. Keep the
        -- current-row predicate literal so generic plans use the current index.
        IF delete_markers != 'only' AND v_peek_name IS NULL AND NOT v_multi_row THEN
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL AND v_is_asc THEN
            IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_next_seek_strict THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- If the peek landed on a different key than we were tracking, any
        -- version boundary belongs to the OLD key and must not leak into the
        -- new one - e.g. the deleteMarkers='only' peek doesn't know or care
        -- whether it's continuing the same key or jumping to a new one, so
        -- it never clears these itself.
        IF lower(v_peek_name) IS DISTINCT FROM v_next_seek THEN
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        END IF;

        -- The peek is authoritative for the next key to process. This is
        -- especially important after exhausting a multi-version key: the
        -- version boundary has been cleared, so executing the batch against
        -- a stale v_next_seek would replay every version of that old key.
        v_next_seek := lower(v_peek_name);
        v_next_seek_strict := false;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                version := NULL;
                archived_at := NULL;
                is_delete_marker := NULL;
                is_versioned := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size,
                    v_next_seek_at, v_next_seek_version
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too - it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN lower(v_current.name)
                        ELSE lower(v_current.name) || v_delimiter
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    version := v_current.version;
                    archived_at := v_current.archived_at;
                    is_delete_marker := v_current.is_delete_marker;
                    is_versioned := v_current.is_versioned;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Multi-row mode must remain on this key until all of its
                -- versions have crossed the internal batch boundary.
                IF v_multi_row THEN
                    v_next_seek := lower(v_current.name);
                    v_next_seek_at := COALESCE(v_current.archived_at, 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor would
                    -- skip a real key like `name || '!'` (or any character
                    -- sorting below the delimiter), which sorts between `name`
                    -- and `name || delimiter`. Track the real name and mark the
                    -- next comparison strict instead - same fix as the
                    -- exhausted-key case above.
                    v_next_seek := lower(v_current.name);
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_skipped = v_previous_skipped
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.search made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, p_start_after_version text DEFAULT ''::text)
 RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_prefix_pattern text;
    v_sort_order text;
    v_sort_column text;
    v_version_tiebreak text;
BEGIN
    v_prefix := coalesce(p_prefix, '');
    -- Keep the raw prefix for common-prefix calculations and escape only LIKE metacharacters.
    v_prefix_pattern := replace(v_prefix, chr(92), chr(92) || chr(92));
    v_prefix_pattern := replace(v_prefix_pattern, '%', chr(92) || '%');
    v_prefix_pattern := replace(v_prefix_pattern, '_', chr(92) || '_');

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    -- $9 is only populated in multi-row mode; it's always '' otherwise, so
    -- only use each row's real version as a tiebreak in multi-row mode.
    v_version_tiebreak := CASE WHEN noncurrent_versions IN ('only', 'include') THEN 'COALESCE(version, '''')' ELSE '''''' END;

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                o.version AS obj_version,
                o.archived_at AS obj_archived_at,
                o.is_delete_marker AS obj_is_delete_marker,
                o.is_versioned AS obj_is_versioned,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $10 || '%%'
              AND ($7 != 'exclude' OR o.archived_at IS NULL)
              AND ($7 != 'only' OR o.archived_at IS NOT NULL)
              AND ($8 != 'exclude' OR NOT o.is_delete_marker)
              AND ($8 != 'only' OR o.is_delete_marker)
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                common_prefix AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                NULL::text AS version,
                NULL::timestamptz AS archived_at,
                NULL::boolean AS is_delete_marker,
                NULL::boolean AS is_versioned,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                obj_version AS version,
                obj_archived_at AS archived_at,
                obj_is_delete_marker AS is_delete_marker,
                obj_is_versioned AS is_versioned,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz),
                    name COLLATE "C",
                    %s
                ) %s ROW(
                    -- truncated the same way as the stored value above
                    date_trunc('milliseconds', COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz)),
                    $5,
                    $9
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata,
            version,
            archived_at,
            is_delete_marker,
            is_versioned
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s,
            COALESCE(version, '') %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_version_tiebreak,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order,
        v_sort_order
    );

    -- version is the third tiebreak component for two versions of the same
    -- key tying on both timestamp and name (see filtered CTE / ORDER BY above)
    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after, noncurrent_versions, delete_markers, coalesce(p_start_after_version, ''), v_prefix_pattern;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, start_after_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, start_after_version text DEFAULT ''::text, start_after_is_continuation boolean DEFAULT false)
 RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata,
            l.version,
            l.archived_at,
            l.is_delete_marker,
            l.is_versioned
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            CASE WHEN start_after_is_continuation THEN '' ELSE start_after END,
            CASE WHEN start_after_is_continuation THEN start_after ELSE '' END,
            v_sort_ord,
            noncurrent_versions,
            delete_markers,
            start_after_archived_at,
            start_after_version
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after,
            noncurrent_versions, delete_markers, start_after_version
        );
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION storage.get_size_by_bucket(noncurrent_versions text DEFAULT 'include'::text, delete_markers text DEFAULT 'include'::text)
 RETURNS TABLE(size bigint, bucket_id text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'include');
    delete_markers := COALESCE(delete_markers, 'include');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'include';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'include';
    END IF;

    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        where (noncurrent_versions != 'exclude' OR obj.archived_at IS NULL)
          and (noncurrent_versions != 'only' OR obj.archived_at IS NOT NULL)
          and (delete_markers != 'exclude' OR NOT obj.is_delete_marker)
          and (delete_markers != 'only' OR obj.is_delete_marker)
        group by obj.bucket_id;
END
$function$
;

CREATE OR REPLACE FUNCTION public.guard_extra_assets_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- The entitlement flag is server-managed; only redeem_system_access_code,
  -- which sets app.extra_assets_grant for its transaction, may change it.
  IF NEW.extra_assets_entitled IS DISTINCT FROM OLD.extra_assets_entitled
     AND COALESCE(current_setting('app.extra_assets_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'extra_assets_entitled is managed server-side only';
  END IF;

  -- show_extra_assets may switch on only for entitled users. Entitled users
  -- keep the disable / re-enable toggle (with its existing 2h cooldown);
  -- never-entitled users cannot self-grant through PostgREST any more.
  IF NEW.show_extra_assets IS TRUE
     AND OLD.show_extra_assets IS DISTINCT FROM TRUE
     AND NEW.extra_assets_entitled IS NOT TRUE
     AND COALESCE(current_setting('app.extra_assets_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'show_extra_assets requires server-side entitlement';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.redeem_system_access_code(p_access_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_code    public.system_access_codes%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;

  -- Best-effort per-user throttle (fail-open like every other
  -- check_rate_limit call site): 20 attempts / hour / user.
  BEGIN
    IF public.check_rate_limit(v_user_id::text, 'system_access_code_redeem', 20, 60) IS FALSE THEN
      RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT * INTO v_code
    FROM public.system_access_codes
   WHERE access_key = p_access_key
   FOR UPDATE;

  IF NOT FOUND OR v_code.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  IF COALESCE(v_code.used_count, 0) >= COALESCE(v_code.max_uses, 1) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'exhausted');
  END IF;

  UPDATE public.system_access_codes
     SET used_count = COALESCE(used_count, 0) + 1
   WHERE access_key = p_access_key;

  PERFORM set_config('app.extra_assets_grant', 'on', true);

  UPDATE public.profiles
     SET extra_assets_entitled = true,
         show_extra_assets = true
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_missing');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id     uuid;
  v_attempt     public.quiz_attempts%ROWTYPE;
  v_score       integer;
  v_total       integer;
  v_answers     jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'finish_quiz_attempt requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE id = p_attempt_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz attempt not found' USING ERRCODE = '42501';
  END IF;

  IF v_attempt.user_id <> v_user_id THEN
    RAISE EXCEPTION 'quiz attempt does not belong to the caller'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent retry: return the stored graded state instead of re-grading.
  IF v_attempt.finished_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'reason', 'already_finished',
      'score', v_attempt.score,
      'total_questions', v_attempt.total_questions,
      'answers', COALESCE(v_attempt.answers, '[]'::jsonb)
    );
  END IF;

  -- Authoritative re-grade: overwrite the client-sent is_correct flags.
  UPDATE public.quiz_answers qa
     SET is_correct = (
           qa.selected_option IS NOT NULL
           AND qa.selected_option = qq.correct_answer
         )
    FROM public.quiz_questions qq
   WHERE qa.question_id = qq.id
     AND qa.attempt_id = v_attempt.id;

  SELECT count(*) FILTER (WHERE a.is_correct),
         (SELECT count(*) FROM public.quiz_questions qq
           WHERE qq.quiz_id = v_attempt.quiz_id)
    INTO v_score, v_total
    FROM public.quiz_answers a
   WHERE a.attempt_id = v_attempt.id;

  -- Authoritative answers payload in the shape the history/review UIs read.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'question_id', a.question_id,
             'selected_option', a.selected_option,
             'is_correct', a.is_correct
           ) ORDER BY qq.order_index
         ), '[]'::jsonb)
    INTO v_answers
    FROM public.quiz_answers a
    JOIN public.quiz_questions qq ON qq.id = a.question_id
   WHERE a.attempt_id = v_attempt.id;

  PERFORM set_config('app.quiz_grading', 'on', true);

  UPDATE public.quiz_attempts
     SET score = v_score,
         total_questions = v_total,
         finished_at = now(),
         time_taken_seconds = COALESCE(
           p_time_taken_seconds,
           floor(EXTRACT(EPOCH FROM (now() - v_attempt.started_at)))::integer
         ),
         answers = v_answers
   WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'total_questions', v_total,
    'answers', v_answers
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_grading()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('app.quiz_grading', true), '') <> 'on'
     AND (
       NEW.score IS DISTINCT FROM OLD.score
       OR NEW.total_questions IS DISTINCT FROM OLD.total_questions
       OR NEW.finished_at IS DISTINCT FROM OLD.finished_at
       OR NEW.answers IS DISTINCT FROM OLD.answers
       OR NEW.time_taken_seconds IS DISTINCT FROM OLD.time_taken_seconds
     )
  THEN
    RAISE EXCEPTION 'quiz attempt grading is managed server-side only (spec 030)';
  END IF;

  RETURN NEW;
END;
$function$
;

-- ===== deferred =====
ALTER TABLE public.quizzes ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ===== indexes =====
CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);
CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);
CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");
CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);
CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);
CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);
CREATE INDEX idx_summaries_status ON public.summaries USING btree (status);
CREATE INDEX idx_summaries_department ON public.summaries USING btree (department);
CREATE INDEX idx_summaries_year ON public.summaries USING btree (year);
CREATE INDEX idx_summaries_created_at ON public.summaries USING btree (created_at DESC);
CREATE INDEX idx_news_active ON public.news USING btree (is_active);
CREATE INDEX idx_news_type ON public.news USING btree (type);
CREATE INDEX idx_news_priority ON public.news USING btree (priority DESC);
CREATE INDEX idx_news_created_at ON public.news USING btree (created_at DESC);
CREATE INDEX idx_appeals_content ON public.appeals USING btree (content_id, content_type);
CREATE INDEX idx_appeals_created_by ON public.appeals USING btree (created_by);
CREATE INDEX idx_chats_created_by ON public.chats USING btree (created_by);
CREATE INDEX idx_chats_created_at ON public.chats USING btree (created_at DESC);
CREATE INDEX idx_messages_chat_id ON public.messages USING btree (chat_id);
CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);
CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);
CREATE INDEX idx_ai_summaries_chat_id ON public.ai_summaries USING btree (chat_id);
CREATE INDEX idx_ai_summaries_created_at ON public.ai_summaries USING btree (created_at DESC);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);
CREATE INDEX idx_analytics_user_id ON public.analytics USING btree (user_id);
CREATE INDEX idx_analytics_action_type ON public.analytics USING btree (action_type);
CREATE INDEX idx_analytics_content_type ON public.analytics USING btree (content_type);
CREATE INDEX idx_analytics_created_at ON public.analytics USING btree (created_at);
CREATE INDEX idx_assistant_messages_user_id ON public.assistant_messages USING btree (user_id);
CREATE INDEX idx_assistant_messages_session_id ON public.assistant_messages USING btree (session_id);
CREATE INDEX idx_assistant_messages_created_at ON public.assistant_messages USING btree (created_at);
CREATE INDEX idx_content_analytics_content_type ON public.content_analytics USING btree (content_type);
CREATE INDEX idx_content_analytics_content_id ON public.content_analytics USING btree (content_id);
CREATE INDEX idx_exhausted_api_keys_user_id ON public.exhausted_api_keys USING btree (user_id);
CREATE INDEX idx_exhausted_api_keys_api_key ON public.exhausted_api_keys USING btree (api_key);
CREATE INDEX idx_appeals_status ON public.appeals USING btree (status);
CREATE INDEX idx_system_logs_level ON public.system_logs USING btree (level);
CREATE INDEX idx_system_logs_created_at ON public.system_logs USING btree (created_at);
CREATE INDEX idx_quizzes_user_id ON public.quizzes USING btree (user_id);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions USING btree (quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts USING btree (user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts USING btree (quiz_id);
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens USING btree (email);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);
CREATE INDEX idx_summaries_user_id ON public.summaries USING btree (user_id);
CREATE INDEX idx_summaries_subject_hash ON public.summaries USING hash (subject);
CREATE INDEX idx_summaries_subject_approved ON public.summaries USING btree (subject) WHERE (status = 'approved'::text);
CREATE INDEX profiles_username_idx ON public.profiles USING btree (username);
CREATE INDEX profiles_full_name_idx ON public.profiles USING btree (full_name);
CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, read);
CREATE INDEX idx_appeals_created_at ON public.appeals USING btree (created_at DESC);
CREATE INDEX idx_quizzes_summary_id ON public.quizzes USING btree (summary_id);
CREATE INDEX idx_quizzes_status ON public.quizzes USING btree (status);
CREATE INDEX idx_quizzes_created_at ON public.quizzes USING btree (created_at DESC);
CREATE INDEX idx_courses_instructor_id ON public.courses USING btree (instructor_id);
CREATE INDEX idx_courses_is_published ON public.courses USING btree (is_published);
CREATE INDEX idx_courses_created_at ON public.courses USING btree (created_at DESC);
CREATE INDEX idx_course_files_course_id ON public.course_files USING btree (course_id);
CREATE INDEX idx_course_files_order_index ON public.course_files USING btree (order_index);
CREATE INDEX idx_course_summaries_course_id ON public.course_summaries USING btree (course_id);
CREATE INDEX idx_course_summaries_order_index ON public.course_summaries USING btree (order_index);
CREATE INDEX idx_course_videos_course_id ON public.course_videos USING btree (course_id);
CREATE INDEX idx_course_videos_language ON public.course_videos USING btree (language);
CREATE INDEX idx_course_videos_order_index ON public.course_videos USING btree (order_index);
CREATE UNIQUE INDEX ux_rate_limits_identifier_endpoint ON public.rate_limits USING btree (identifier, endpoint);
CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_reviews_course_id ON public.reviews USING btree (course_id) WHERE (course_id IS NOT NULL);
CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");
CREATE INDEX idx_videos_subject ON public.videos USING btree (subject);
CREATE INDEX idx_files_subject ON public.files USING btree (subject);
CREATE INDEX idx_subject_lectures_subject ON public.subject_lectures USING btree (subject);
CREATE INDEX idx_subject_lectures_order_index ON public.subject_lectures USING btree (order_index);
CREATE INDEX idx_subjects_level ON public.subjects USING btree (level);
CREATE INDEX academic_levels_active_sort_idx ON public.academic_levels USING btree (is_active, sort_order, level_number, name);
CREATE INDEX departments_active_sort_idx ON public.departments USING btree (is_active, sort_order, name);
CREATE INDEX departments_level_idx ON public.departments USING btree (academic_level_id);
CREATE INDEX idx_admins_user_id ON public.admins USING btree (user_id);
CREATE INDEX idx_chat_participants_chat_id ON public.chat_participants USING btree (chat_id);
CREATE INDEX idx_user_progress_user_id ON public.user_progress USING btree (user_id);
CREATE INDEX idx_profiles_department_id ON public.profiles USING btree (department_id);
CREATE INDEX idx_profiles_extra_assets_updated_at ON public.profiles USING btree (show_extra_assets_updated_at) WHERE (show_extra_assets_updated_at IS NOT NULL);
CREATE INDEX idx_trw_memberships_user_lookup ON public.trw_memberships USING btree (user_id, revoked_at, expires_at);
CREATE INDEX idx_trw_user_progress_user ON public.trw_user_progress USING btree (user_id);
CREATE INDEX idx_ai_chat_messages_user_id ON public.ai_chat_messages USING btree (user_id);
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages USING btree (created_at);
CREATE INDEX videos_subject_lecture_id_idx ON public.videos USING btree (subject, lecture_id);
CREATE INDEX summaries_subject_lecture_id_idx ON public.summaries USING btree (subject, lecture_id);
CREATE INDEX files_subject_lecture_id_idx ON public.files USING btree (subject, lecture_id);
CREATE INDEX quizzes_subject_lecture_id_idx ON public.quizzes USING btree (subject, lecture_id);
CREATE INDEX tracked_links_slug_idx ON public.tracked_links USING btree (slug);
CREATE INDEX link_logs_link_id_idx ON public.link_logs USING btree (link_id);
CREATE INDEX link_logs_created_at_idx ON public.link_logs USING btree (created_at);
CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL);
CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned);
CREATE INDEX idx_ai_chat_user_mode_created ON public.ai_chat_messages USING btree (user_id, mode, created_at);
CREATE UNIQUE INDEX ux_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE UNIQUE INDEX waitlist_email_source_unique ON public.waitlist USING btree (lower(email), source);
CREATE INDEX idx_objects_delete_markers ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE is_delete_marker;

-- ===== views =====
CREATE VIEW public.user_roles WITH (security_invoker=on) AS
 SELECT id,
    email,
    raw_user_meta_data ->> 'role'::text AS role,
    created_at,
    email_confirmed_at
   FROM auth.users;

CREATE VIEW public.user_profiles WITH (security_invoker=on) AS
 SELECT id,
    email,
    raw_user_meta_data ->> 'display_name'::text AS display_name,
    created_at,
    email_confirmed_at
   FROM auth.users;

CREATE VIEW public.summaries_with_ratings WITH (security_invoker=on) AS
 SELECT s.id,
    s.title,
    s.subject,
    s.year,
    s.department,
    s.content,
    s.pdf_url,
    s.contributor_name,
    s.status,
    s.created_at,
    s.updated_at,
    s.user_id,
    COALESCE(avg(r.rating), 0::numeric)::numeric(3,2) AS avg_rating,
    count(r.id) AS reviews_count
   FROM summaries s
     LEFT JOIN reviews r ON s.id = r.summary_id
  GROUP BY s.id;

CREATE VIEW public.quizzes_with_ratings WITH (security_invoker=on) AS
 SELECT q.id,
    q.title,
    q.description,
    q.user_id,
    q.source_type,
    q.created_at,
    q.summary_id,
    q.subject,
    q.department,
    q.year,
    q.status,
    COALESCE(avg(r.rating), 0::numeric) AS avg_rating,
    count(r.id) AS reviews_count
   FROM quizzes q
     LEFT JOIN reviews r ON q.id = r.quiz_id
  GROUP BY q.id;

CREATE VIEW public.review_details WITH (security_invoker=true) AS
 SELECT r.id,
    r.rating,
    r.content AS comment,
    r.user_id,
    r.summary_id,
    r.quiz_id,
    r.course_id,
    r.video_id,
    r.created_at,
    p.full_name AS reviewer_name,
    p.avatar_url AS reviewer_avatar
   FROM reviews r
     LEFT JOIN profiles p ON r.user_id = p.id;

CREATE VIEW public.lectures_with_ratings WITH (security_invoker=true) AS
 SELECT v.id,
    v.subject,
    v.title,
    v.url,
    v.language,
    v.user_id,
    v.created_at,
    v.lecture_key,
    v.lecture_id,
    round(avg(r.rating), 1)::double precision AS avg_rating,
    count(r.id)::integer AS reviews_count
   FROM videos v
     LEFT JOIN reviews r ON v.id = r.video_id
  GROUP BY v.id, v.subject, v.title, v.url, v.language, v.user_id, v.created_at, v.lecture_key, v.lecture_id;

-- ===== triggers =====
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
CREATE TRIGGER update_chats_updated_at_trigger BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION update_chats_updated_at();
CREATE TRIGGER update_messages_updated_at_trigger BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION update_messages_updated_at();
CREATE TRIGGER update_ai_summaries_updated_at_trigger BEFORE UPDATE ON public.ai_summaries FOR EACH ROW EXECUTE FUNCTION update_ai_summaries_updated_at();
CREATE TRIGGER ai_summarization_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION trigger_chat_ai_summarization();
CREATE TRIGGER tr_update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_quiz_attempts_updated_at BEFORE UPDATE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_course_files_updated_at BEFORE UPDATE ON public.course_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_course_summaries_updated_at BEFORE UPDATE ON public.course_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_course_videos_updated_at BEFORE UPDATE ON public.course_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_update_summaries_updated_at BEFORE UPDATE ON public.summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_audit_courses_changes AFTER DELETE OR UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER tr_audit_profiles_changes AFTER DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER tr_audit_admins_changes AFTER DELETE OR UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER trg_enforce_show_extra_assets_cooldown BEFORE UPDATE OF show_extra_assets ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_show_extra_assets_cooldown();
CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_academic_levels_updated_at BEFORE UPDATE ON public.academic_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER summaries_status_guard BEFORE UPDATE OF status ON public.summaries FOR EACH ROW EXECUTE FUNCTION summaries_status_guard();
CREATE TRIGGER on_admin_upsert AFTER INSERT OR UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION sync_user_role_to_metadata();
CREATE TRIGGER on_admin_delete AFTER DELETE ON public.admins FOR EACH ROW EXECUTE FUNCTION remove_user_role_from_metadata();
CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');
CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();
CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');
CREATE TRIGGER trg_guard_extra_assets_entitlement BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_extra_assets_columns();
CREATE TRIGGER trg_guard_quiz_attempt_score BEFORE UPDATE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION guard_quiz_attempt_grading();

-- ===== policies =====
CREATE POLICY academic_levels_read_all ON public.academic_levels AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY allow_public_select ON public.academic_levels AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY admins_delete_admin_only ON public.admins AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY admins_insert_admin_only ON public.admins AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY admins_select_all ON public.admins AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY admins_select_own ON public.admins AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY admins_update_admin_only ON public.admins AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can delete their own chat messages" ON public.ai_chat_messages AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own chat messages" ON public.ai_chat_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own chat messages" ON public.ai_chat_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY ai_summaries_insert_for_member ON public.ai_summaries AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM chat_participants
  WHERE ((chat_participants.chat_id = ai_summaries.chat_id) AND (chat_participants.user_id = auth.uid())))));
CREATE POLICY ai_summaries_select_for_member_auth ON public.ai_summaries AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM chat_participants
  WHERE ((chat_participants.chat_id = ai_summaries.chat_id) AND (chat_participants.user_id = auth.uid())))));
CREATE POLICY analytics_insert_for_authenticated ON public.analytics AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY appeals_delete_admin ON public.appeals AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY appeals_insert_own ON public.appeals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));
CREATE POLICY appeals_select_admin ON public.appeals AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY appeals_select_own ON public.appeals AS PERMISSIVE FOR SELECT TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY appeals_update_admin ON public.appeals AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY assistant_messages_insert_for_authenticated ON public.assistant_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can view audit logs for their courses" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE (((courses.id)::text = (audit_logs.changed_data ->> 'course_id'::text)) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Students can view their enrollment audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((((changed_data ->> 'student_id'::text) = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM enrollments
  WHERE (((enrollments.id)::text = (audit_logs.changed_data ->> 'enrollment_id'::text)) AND (enrollments.student_id = auth.uid()))))));
CREATE POLICY cp_delete_own ON public.chat_participants AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY cp_insert_authenticated ON public.chat_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY cp_insert_own_auth ON public.chat_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY cp_select_own_auth ON public.chat_participants AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY cp_update_own ON public.chat_participants AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY chats_delete_for_creator ON public.chats AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = created_by));
CREATE POLICY chats_insert_for_authenticated ON public.chats AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
CREATE POLICY chats_select_for_member_auth ON public.chats AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM chat_participants
  WHERE ((chat_participants.chat_id = chats.id) AND (chat_participants.user_id = auth.uid())))));
CREATE POLICY chats_update_for_creator ON public.chats AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = created_by)) WITH CHECK ((auth.uid() = created_by));
CREATE POLICY content_analytics_admin_all ON public.content_analytics AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can view all files" ON public.course_files AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Doctor admins can delete any file" ON public.course_files AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Doctor admins can update any file" ON public.course_files AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Enrolled students can view course files" ON public.course_files AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = course_files.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::text)))));
CREATE POLICY "Instructors can create files" ON public.course_files AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_files.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can delete files" ON public.course_files AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_files.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can update files" ON public.course_files AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_files.course_id) AND (courses.instructor_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_files.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can view files for their courses" ON public.course_files AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_files.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Admins can view all summaries" ON public.course_summaries AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Doctor admins can delete any summary" ON public.course_summaries AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Doctor admins can update any summary" ON public.course_summaries AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Enrolled students can view course summaries" ON public.course_summaries AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = course_summaries.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::text)))));
CREATE POLICY "Instructors can create summaries" ON public.course_summaries AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_summaries.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can delete summaries" ON public.course_summaries AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_summaries.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can update summaries" ON public.course_summaries AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_summaries.course_id) AND (courses.instructor_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_summaries.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can view summaries for their courses" ON public.course_summaries AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_summaries.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Admins can view all videos" ON public.course_videos AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Doctor admins can delete any video" ON public.course_videos AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Doctor admins can update any video" ON public.course_videos AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Enrolled students can view course videos" ON public.course_videos AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = course_videos.course_id) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::text)))));
CREATE POLICY "Instructors can create videos" ON public.course_videos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_videos.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can delete videos" ON public.course_videos AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_videos.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can update videos" ON public.course_videos AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_videos.course_id) AND (courses.instructor_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_videos.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can view videos for their courses" ON public.course_videos AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = course_videos.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Admins can create courses" ON public.courses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can delete any course" ON public.courses AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can update any course" ON public.courses AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can view all courses" ON public.courses AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Authenticated users can view published courses" ON public.courses AS PERMISSIVE FOR SELECT TO authenticated USING ((is_published = true));
CREATE POLICY "Doctor admins can manage all courses" ON public.courses AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text)))));
CREATE POLICY "Instructors can create courses" ON public.courses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = instructor_id));
CREATE POLICY "Instructors can delete their own courses" ON public.courses AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = instructor_id));
CREATE POLICY "Instructors can update their own courses" ON public.courses AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = instructor_id)) WITH CHECK ((auth.uid() = instructor_id));
CREATE POLICY "Instructors can view their own courses" ON public.courses AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = instructor_id));
CREATE POLICY "Students can view published courses" ON public.courses AS PERMISSIVE FOR SELECT TO authenticated USING ((is_published = true));
CREATE POLICY courses_anon_view_published ON public.courses AS PERMISSIVE FOR SELECT TO anon USING ((is_published = true));
CREATE POLICY allow_public_select ON public.departments AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY departments_read_all ON public.departments AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can delete any enrollment" ON public.enrollments AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can update any enrollment" ON public.enrollments AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can view all enrollments" ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can approve enrollments for their courses" ON public.enrollments AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = enrollments.course_id) AND (courses.instructor_id = auth.uid())))) AND (status = 'pending'::text))) WITH CHECK (((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = enrollments.course_id) AND (courses.instructor_id = auth.uid())))) AND (status = ANY (ARRAY['active'::text, 'expired'::text, 'rejected'::text]))));
CREATE POLICY "Instructors can delete enrollments for their courses" ON public.enrollments AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = enrollments.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Instructors can view enrollments for their courses" ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = enrollments.course_id) AND (courses.instructor_id = auth.uid())))));
CREATE POLICY "Students can create enrollments" ON public.enrollments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = student_id) AND (status = 'pending'::text)));
CREATE POLICY "Students can delete their own pending enrollments" ON public.enrollments AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = student_id) AND (status = 'pending'::text)));
CREATE POLICY "Students can reapply after rejection" ON public.enrollments AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = student_id) AND (status = ANY (ARRAY['rejected'::text, 'expired'::text])))) WITH CHECK (((auth.uid() = student_id) AND (status = 'pending'::text)));
CREATE POLICY "Students can view their own enrollments" ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = student_id));
CREATE POLICY service_role_can_manage_all_exhausted_keys ON public.exhausted_api_keys AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY users_can_insert_own_exhausted_keys ON public.exhausted_api_keys AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY users_can_read_own_exhausted_keys ON public.exhausted_api_keys AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Anyone can view files" ON public.files AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Instructors can delete files" ON public.files AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can insert files" ON public.files AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can update files" ON public.files AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Users can view logs for their own links" ON public.link_logs AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM tracked_links
  WHERE ((tracked_links.id = link_logs.link_id) AND (tracked_links.created_by = auth.uid())))));
CREATE POLICY messages_insert_for_member ON public.messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM chat_participants
  WHERE ((chat_participants.chat_id = messages.chat_id) AND (chat_participants.user_id = auth.uid())))));
CREATE POLICY messages_select_for_member_auth ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM chat_participants
  WHERE ((chat_participants.chat_id = messages.chat_id) AND (chat_participants.user_id = auth.uid())))));
CREATE POLICY "Anyone can view active news" ON public.news AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY news_manage_admin ON public.news AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users can update their own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY notifications_insert_own ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Service role can manage reset tokens" ON public.password_reset_tokens AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY platform_settings_delete_admin ON public.platform_settings AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY platform_settings_insert_admin ON public.platform_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY platform_settings_select_all ON public.platform_settings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY platform_settings_update_admin ON public.platform_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY profiles_insert_own ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
CREATE POLICY profiles_select_authenticated ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY quiz_answers_insert_own ON public.quiz_answers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM quiz_attempts
  WHERE ((quiz_attempts.id = quiz_answers.attempt_id) AND (quiz_attempts.user_id = auth.uid())))));
CREATE POLICY quiz_answers_select_own ON public.quiz_answers AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM quiz_attempts
  WHERE ((quiz_attempts.id = quiz_answers.attempt_id) AND (quiz_attempts.user_id = auth.uid())))));
CREATE POLICY quiz_answers_update_own ON public.quiz_answers AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM quiz_attempts
  WHERE ((quiz_attempts.id = quiz_answers.attempt_id) AND (quiz_attempts.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM quiz_attempts
  WHERE ((quiz_attempts.id = quiz_answers.attempt_id) AND (quiz_attempts.user_id = auth.uid())))));
CREATE POLICY "Admins can view all quiz attempts" ON public.quiz_attempts AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own attempts" ON public.quiz_attempts AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete questions of own or admin" ON public.quiz_questions AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM quizzes
  WHERE ((quizzes.id = quiz_questions.quiz_id) AND ((quizzes.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins
          WHERE (admins.user_id = auth.uid()))))))));
CREATE POLICY "Users can insert questions to own or admin" ON public.quiz_questions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM quizzes
  WHERE ((quizzes.id = quiz_questions.quiz_id) AND ((quizzes.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins
          WHERE (admins.user_id = auth.uid()))))))));
CREATE POLICY "Users can update questions of own or admin" ON public.quiz_questions AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM quizzes
  WHERE ((quizzes.id = quiz_questions.quiz_id) AND ((quizzes.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins
          WHERE (admins.user_id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM quizzes
  WHERE ((quizzes.id = quiz_questions.quiz_id) AND ((quizzes.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins
          WHERE (admins.user_id = auth.uid()))))))));
CREATE POLICY "Users can view questions of own or approved quizzes, admins see" ON public.quiz_questions AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM quizzes
  WHERE ((quizzes.id = quiz_questions.quiz_id) AND ((quizzes.status = 'approved'::text) OR (quizzes.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins
          WHERE (admins.user_id = auth.uid()))))))));
CREATE POLICY "Public can view approved quizzes" ON public.quizzes AS PERMISSIVE FOR SELECT TO anon USING ((status = 'approved'::text));
CREATE POLICY "Users can delete own or admin quizzes" ON public.quizzes AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))));
CREATE POLICY "Users can insert own quizzes" ON public.quizzes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own or admin quizzes" ON public.quizzes AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))));
CREATE POLICY "Users can view own or approved quizzes, admins see all" ON public.quizzes AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (status = 'approved'::text) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))));
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits AS PERMISSIVE FOR ALL TO service_role USING (true);
CREATE POLICY reviews_delete_admin ON public.reviews AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY reviews_delete_own ON public.reviews AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY reviews_insert_course_enrolled ON public.reviews AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.student_id = auth.uid()) AND (enrollments.course_id = reviews.course_id) AND (enrollments.status = 'active'::text))))));
CREATE POLICY reviews_insert_quiz_summary ON public.reviews AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (course_id IS NULL) AND ((quiz_id IS NOT NULL) OR (summary_id IS NOT NULL) OR (video_id IS NOT NULL))));
CREATE POLICY reviews_read_all ON public.reviews AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY reviews_select_all ON public.reviews AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY reviews_update_admin ON public.reviews AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY reviews_update_own ON public.reviews AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Admins can delete subject lectures" ON public.subject_lectures AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can insert subject lectures" ON public.subject_lectures AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can update subject lectures" ON public.subject_lectures AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Anyone can view subject lectures" ON public.subject_lectures AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to subjects" ON public.subjects AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY subjects_delete_admin ON public.subjects AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY subjects_insert_admin ON public.subjects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY subjects_update_admin ON public.subjects AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Anyone can view approved summaries" ON public.summaries AS PERMISSIVE FOR SELECT TO public USING ((status = 'approved'::text));
CREATE POLICY summaries_delete_own_or_admin ON public.summaries AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY summaries_insert_authenticated ON public.summaries AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY summaries_select_own_or_admin ON public.summaries AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY summaries_update_own_or_admin ON public.summaries AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR is_admin())) WITH CHECK (((auth.uid() = user_id) OR is_admin()));
CREATE POLICY "Allow admins to manage access keys" ON public.system_access_codes AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Admins can view logs" ON public.system_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "Service role full access" ON public.system_logs AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY system_logs_insert_constrained ON public.system_logs AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (((level = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text, 'fatal'::text])) AND ((char_length(message) >= 1) AND (char_length(message) <= 2000))));
CREATE POLICY "Users can manage their own links" ON public.tracked_links AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = created_by));
CREATE POLICY trw_access_code_redemptions_select_own ON public.trw_access_code_redemptions AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY trw_access_code_redemptions_service_role_all ON public.trw_access_code_redemptions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trw_categories_select_published ON public.trw_categories AS PERMISSIVE FOR SELECT TO public USING ((is_published = true));
CREATE POLICY trw_membership_audit_log_select_own ON public.trw_membership_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY trw_membership_audit_log_service_role_all ON public.trw_membership_audit_log AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trw_memberships_select_own ON public.trw_memberships AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY trw_plan_category_access_select_active_plan ON public.trw_plan_category_access AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM trw_plan_definitions p
  WHERE ((p.id = trw_plan_category_access.plan_id) AND (p.is_active = true)))));
CREATE POLICY trw_plan_category_access_service_role_all ON public.trw_plan_category_access AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trw_plan_definitions_select_active ON public.trw_plan_definitions AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY trw_plan_definitions_service_role_all ON public.trw_plan_definitions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trw_user_progress_insert_own ON public.trw_user_progress AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND is_trw_member()));
CREATE POLICY trw_user_progress_select_own ON public.trw_user_progress AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY user_progress_delete_own ON public.user_progress AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY user_progress_insert_own ON public.user_progress AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY user_progress_select_own ON public.user_progress AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Anyone can view videos" ON public.videos AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Instructors can delete videos" ON public.videos AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can insert videos" ON public.videos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "Instructors can update videos" ON public.videos AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY waitlist_insert_any ON public.waitlist AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage all course materials" ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))))) WITH CHECK (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))));
CREATE POLICY "Admins can view all payment proofs" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid())))));
CREATE POLICY "Allow anyone to upload  1xwkmju_0" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow anyone to view PDFs 1xwkmju_0" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can upload PDFs" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'summaries-pdfs'::text));
CREATE POLICY "Authenticated users can delete PDFs 1xwkmju_0" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can delete PDFs 1xwkmju_1" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can upload images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'quiz-images'::text));
CREATE POLICY "Doctor admins can delete all payment proofs" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.role = 'doctor'::text))))));
CREATE POLICY "Enrolled students can download course materials" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = ((storage.foldername(objects.name))[1])::uuid) AND (enrollments.student_id = auth.uid()) AND (enrollments.status = 'active'::text))))));
CREATE POLICY "Instructors can delete payment proofs" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM (enrollments e
     JOIN courses c ON ((c.id = e.course_id)))
  WHERE (((e.student_id)::text = (storage.foldername(objects.name))[1]) AND (c.instructor_id = auth.uid()))))));
CREATE POLICY "Instructors can delete their course materials" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = ((storage.foldername(objects.name))[1])::uuid) AND (courses.instructor_id = auth.uid()))))));
CREATE POLICY "Instructors can manage their course materials" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = ((storage.foldername(objects.name))[1])::uuid) AND (courses.instructor_id = auth.uid())))))) WITH CHECK (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = ((storage.foldername(objects.name))[1])::uuid) AND (courses.instructor_id = auth.uid()))))));
CREATE POLICY "Instructors can upload course materials" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'course-materials'::text) AND (EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = ((storage.foldername(objects.name))[1])::uuid) AND (courses.instructor_id = auth.uid()))))));
CREATE POLICY "Instructors can view payment proofs" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM (enrollments e
     JOIN courses c ON ((c.id = e.course_id)))
  WHERE (((e.student_id)::text = (storage.foldername(objects.name))[1]) AND (c.instructor_id = auth.uid()))))));
CREATE POLICY "Public Access" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'quiz-images'::text));
CREATE POLICY "Students can upload payment proofs" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'payment-proofs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete their own images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'quiz-images'::text) AND (auth.uid() = owner)));

-- ===== grants =====
GRANT CREATE, USAGE ON SCHEMA storage TO dashboard_user;
GRANT CREATE, USAGE ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO postgres;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.academic_levels TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.academic_levels TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.academic_levels TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.admins TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.admins TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.admins TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_summaries TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_summaries TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_summaries TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.appeals TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.appeals TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.appeals TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.assistant_messages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.assistant_messages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.assistant_messages TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.audit_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_participants TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_participants TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_participants TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chats TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chats TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chats TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.content_analytics TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.content_analytics TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.content_analytics TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_files TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_files TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_files TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_summaries TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_summaries TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_summaries TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_videos TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_videos TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.course_videos TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.courses TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.courses TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.courses TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.departments TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.departments TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.departments TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.enrollments TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.enrollments TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.enrollments TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.exhausted_api_keys TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.exhausted_api_keys TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.exhausted_api_keys TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.files TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.files TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.files TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.lectures_with_ratings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.lectures_with_ratings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.lectures_with_ratings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.link_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.link_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.link_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.messages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.messages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.messages TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.news TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.news TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.news TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.password_reset_tokens TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.password_reset_tokens TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.password_reset_tokens TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.platform_settings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.platform_settings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.platform_settings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_answers TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_answers TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_answers TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_attempts TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_attempts TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_attempts TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_questions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_questions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quiz_questions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes_with_ratings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes_with_ratings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quizzes_with_ratings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rate_limits TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_details TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_details TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_details TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reviews TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reviews TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reviews TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subject_lectures TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subject_lectures TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subject_lectures TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subjects TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subjects TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subjects TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries_with_ratings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries_with_ratings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.summaries_with_ratings TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_access_codes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_access_codes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_access_codes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.system_logs TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tracked_links TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tracked_links TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tracked_links TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_code_redemptions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_code_redemptions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_code_redemptions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_codes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_codes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_access_codes TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_categories TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_categories TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_categories TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_membership_audit_log TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_membership_audit_log TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_membership_audit_log TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_memberships TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_memberships TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_memberships TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_category_access TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_category_access TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_category_access TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_definitions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_definitions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_plan_definitions TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_user_progress TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_user_progress TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.trw_user_progress TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_progress TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_progress TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_progress TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_roles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_roles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_roles TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.videos TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.videos TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.videos TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.waitlist TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.waitlist TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.waitlist TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.buckets TO postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.buckets TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.buckets_analytics TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.objects TO postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.objects TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.s3_multipart_uploads TO service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON storage.s3_multipart_uploads_parts TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.buckets TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.buckets TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.buckets_analytics TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.buckets_analytics TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.objects TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets_vectors TO anon;
GRANT SELECT ON storage.buckets_vectors TO authenticated;
GRANT SELECT ON storage.buckets_vectors TO service_role;
GRANT SELECT ON storage.s3_multipart_uploads TO anon;
GRANT SELECT ON storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON storage.s3_multipart_uploads_parts TO anon;
GRANT SELECT ON storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON storage.vector_indexes TO anon;
GRANT SELECT ON storage.vector_indexes TO authenticated;
GRANT SELECT ON storage.vector_indexes TO service_role;
REVOKE ALL ON FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_table_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer, p_window_minutes integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_reset_tokens() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_all_analytics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_old_ai_chat_messages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_old_analytics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enable_rls_on_new_table() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_show_extra_assets_cooldown() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_content_analytics_internal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_extra_assets_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_quiz_attempt_grading() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_auth_user_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trw_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trw_member_for_category(p_category_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manual_ai_summarization(chat_uuid uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_of_content(p_type text, p_related_type text, p_related_id uuid, p_title text, p_message text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_system_access_code(p_access_key text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_user_role_from_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_role(user_id uuid, new_role text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.summaries_status_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_user_role_to_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_chat_ai_summarization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trw_redeem_access_code(p_code text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_ai_summaries_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_chats_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_messages_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_display_name(user_id uuid, display_name text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_system_access_code(p_access_key text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_migrate_student_semesters(p_target_semester integer, p_overwrite_manual boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_table_changes() TO anon;
GRANT EXECUTE ON FUNCTION public.audit_table_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_table_changes() TO postgres;
GRANT EXECUTE ON FUNCTION public.audit_table_changes() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer, p_window_minutes integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer, p_window_minutes integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_all_analytics() TO anon;
GRANT EXECUTE ON FUNCTION public.delete_all_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_all_analytics() TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_all_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_old_ai_chat_messages() TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_old_ai_chat_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_old_analytics() TO anon;
GRANT EXECUTE ON FUNCTION public.delete_old_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_analytics() TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_old_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_rls_on_new_table() TO anon;
GRANT EXECUTE ON FUNCTION public.enable_rls_on_new_table() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_rls_on_new_table() TO postgres;
GRANT EXECUTE ON FUNCTION public.enable_rls_on_new_table() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_show_extra_assets_cooldown() TO anon;
GRANT EXECUTE ON FUNCTION public.enforce_show_extra_assets_cooldown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_show_extra_assets_cooldown() TO postgres;
GRANT EXECUTE ON FUNCTION public.enforce_show_extra_assets_cooldown() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_content_analytics_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_analytics_internal() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_content_analytics_internal() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_extra_assets_columns() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_extra_assets_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_extra_assets_columns() TO postgres;
GRANT EXECUTE ON FUNCTION public.guard_extra_assets_columns() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_quiz_attempt_grading() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_quiz_attempt_grading() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_quiz_attempt_grading() TO postgres;
GRANT EXECUTE ON FUNCTION public.guard_quiz_attempt_grading() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_update() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_trw_member() TO anon;
GRANT EXECUTE ON FUNCTION public.is_trw_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trw_member() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_trw_member() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_trw_member_for_category(p_category_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_trw_member_for_category(p_category_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trw_member_for_category(p_category_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.is_trw_member_for_category(p_category_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.manual_ai_summarization(chat_uuid uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.manual_ai_summarization(chat_uuid uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_ai_summarization(chat_uuid uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.manual_ai_summarization(chat_uuid uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins_of_content(p_type text, p_related_type text, p_related_id uuid, p_title text, p_message text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins_of_content(p_type text, p_related_type text, p_related_id uuid, p_title text, p_message text) TO postgres;
GRANT EXECUTE ON FUNCTION public.notify_admins_of_content(p_type text, p_related_type text, p_related_id uuid, p_title text, p_message text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_system_access_code(p_access_key text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_system_access_code(p_access_key text) TO postgres;
GRANT EXECUTE ON FUNCTION public.redeem_system_access_code(p_access_key text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_user_role_from_metadata() TO anon;
GRANT EXECUTE ON FUNCTION public.remove_user_role_from_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_role_from_metadata() TO postgres;
GRANT EXECUTE ON FUNCTION public.remove_user_role_from_metadata() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_role(user_id uuid, new_role text) TO postgres;
GRANT EXECUTE ON FUNCTION public.set_user_role(user_id uuid, new_role text) TO service_role;
GRANT EXECUTE ON FUNCTION public.summaries_status_guard() TO anon;
GRANT EXECUTE ON FUNCTION public.summaries_status_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.summaries_status_guard() TO postgres;
GRANT EXECUTE ON FUNCTION public.summaries_status_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_user_role_to_metadata() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_user_role_to_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_role_to_metadata() TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_user_role_to_metadata() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_chat_ai_summarization() TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_chat_ai_summarization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_chat_ai_summarization() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_chat_ai_summarization() TO service_role;
GRANT EXECUTE ON FUNCTION public.trw_redeem_access_code(p_code text) TO anon;
GRANT EXECUTE ON FUNCTION public.trw_redeem_access_code(p_code text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trw_redeem_access_code(p_code text) TO postgres;
GRANT EXECUTE ON FUNCTION public.trw_redeem_access_code(p_code text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_ai_summaries_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_ai_summaries_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ai_summaries_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_ai_summaries_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_chats_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_chats_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_chats_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_chats_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_messages_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_messages_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_messages_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_messages_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_display_name(user_id uuid, display_name text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_display_name(user_id uuid, display_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_display_name(user_id uuid, display_name text) TO postgres;
GRANT EXECUTE ON FUNCTION public.update_user_display_name(user_id uuid, display_name text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_system_access_code(p_access_key text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_system_access_code(p_access_key text) TO postgres;
GRANT EXECUTE ON FUNCTION public.verify_system_access_code(p_access_key text) TO service_role;

-- ===== defacls =====
-- default ACL (documented, platform-managed; not applied): role=postgres schema=public objtype=r acl=postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres
-- default ACL (documented, platform-managed; not applied): role=postgres schema=public objtype=f acl=postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres
-- default ACL (documented, platform-managed; not applied): role=postgres schema=public objtype=S acl=postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres
-- default ACL (documented, platform-managed; not applied): role=supabase_admin schema=public objtype=S acl=postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin
-- default ACL (documented, platform-managed; not applied): role=supabase_admin schema=public objtype=r acl=postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin
-- default ACL (documented, platform-managed; not applied): role=supabase_admin schema=public objtype=f acl=postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin
-- default ACL (documented, platform-managed; not applied): role=postgres schema=storage objtype=r acl=postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres
-- default ACL (documented, platform-managed; not applied): role=postgres schema=storage objtype=f acl=postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres
-- default ACL (documented, platform-managed; not applied): role=postgres schema=storage objtype=S acl=postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres

COMMIT;
