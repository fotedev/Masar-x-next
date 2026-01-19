CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  answers jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  time_taken_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS answers jsonb;

ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS time_taken_seconds integer;

DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON public.quiz_attempts;

CREATE POLICY "Users can view their own quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create quiz attempts"
  ON public.quiz_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

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
