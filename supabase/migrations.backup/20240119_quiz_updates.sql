-- Create quiz_attempts if not exists
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score INTEGER,
    total_questions INTEGER,
    answers JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    time_taken_seconds INTEGER
);

-- Add columns if they don't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quiz_attempts' AND column_name = 'status') THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quiz_attempts' AND column_name = 'last_updated_at') THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN last_updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Create quiz_answers table
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    selected_option INTEGER,
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflict if re-running
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.quiz_attempts;

DROP POLICY IF EXISTS "Users can view their own answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Users can insert their own answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Users can update their own answers" ON public.quiz_answers;

-- Policies for quiz_attempts
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts" ON public.quiz_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts" ON public.quiz_attempts
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for quiz_answers
CREATE POLICY "Users can view their own answers" ON public.quiz_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = quiz_answers.attempt_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own answers" ON public.quiz_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = attempt_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own answers" ON public.quiz_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = attempt_id AND user_id = auth.uid()
        )
    );
