-- Migration: add quiz duration and quiz_attempts details
-- Purpose: idempotent, secure, and follow best practices for RLS and policies.

-- Create table (only core columns). New columns are added idempotently below.
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable row level security explicitly (safe if table already existed).
ALTER TABLE IF EXISTS public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Ensure quizzes.duration_seconds exists (idempotent).
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

-- Add attempt-detail columns idempotently. Grouped into a single ALTER for clarity.
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS answers jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_taken_seconds integer;

-- Recreate policies in a clean, explicit way.
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can update their own quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON public.quiz_attempts;

-- Allow users to SELECT only their own attempts.
CREATE POLICY "Users can view their own quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to INSERT their own attempts only.
CREATE POLICY "Users can create quiz attempts"
  ON public.quiz_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to UPDATE their own attempts (restricts to owner).
-- This is useful if clients save progress (answers/started_at) before finishing.
CREATE POLICY "Users can update their own quiz attempts"
  ON public.quiz_attempts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow admins (records in public.admins) to view all attempts.
CREATE POLICY "Admins can view all quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  );
