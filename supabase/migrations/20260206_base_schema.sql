-- Base schema migration (generated 2026-02-06)
-- Purpose: Ensure core tables exist before FK/index/policy migrations run.
-- This file is idempotent (uses CREATE TABLE IF NOT EXISTS).

-- 1) subjects
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- 2) rate_limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  message text NOT NULL,
  status_code integer,
  request_id text,
  endpoint text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- 4) summaries
CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL,
  year text NOT NULL,
  department text NOT NULL,
  content text NOT NULL,
  pdf_url text,
  contributor_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5) admins
CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz DEFAULT now(),
  notes text
);

-- 6) courses
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7) course_summaries
CREATE TABLE IF NOT EXISTS course_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8) course_videos
CREATE TABLE IF NOT EXISTS course_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  language text NOT NULL CHECK (language IN ('ar', 'en')),
  duration integer,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9) course_files
CREATE TABLE IF NOT EXISTS course_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10) enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired')),
  payment_screenshot_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 11) reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 12) audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  changed_data jsonb NOT NULL
);

-- 13) quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  content text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 14) quiz_attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score integer,
  total_questions integer,
  answers jsonb,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  time_taken_seconds integer
);

-- 15) quiz_answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  selected_option integer,
  is_correct boolean,
  created_at timestamptz DEFAULT now()
);

-- 16) exhausted_api_keys
CREATE TABLE IF NOT EXISTS public.exhausted_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  exhausted_at timestamptz DEFAULT now(),
  UNIQUE(api_key, user_id)
);

-- 17) analytics
CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action_type text NOT NULL,
  content_type text NOT NULL,
  content_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 18) assistant_messages
CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  session_id text,
  user_message text NOT NULL,
  assistant_response text NOT NULL,
  response_time_ms integer,
  ai_model_used text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 19) content_analytics
CREATE TABLE IF NOT EXISTS public.content_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id text NOT NULL,
  views_count integer DEFAULT 0,
  clicks_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  unique_views_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(content_type, content_id)
);

-- 20) notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('admin_submission', 'content_published', 'system')),
  related_id uuid,
  related_type text CHECK (related_type IN ('summary', 'news', 'appeal')),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 21) news
CREATE TABLE IF NOT EXISTS news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'update', 'important')),
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 22) password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- End of base schema

