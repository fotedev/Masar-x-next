-- 004_content_management.sql
-- 1. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_id uuid REFERENCES auth.users(id),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  price decimal(10,2) DEFAULT 0.00,
  is_published boolean DEFAULT false,
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  duration_minutes int DEFAULT 30,
  max_attempts int DEFAULT 1,
  passing_score int DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Summaries Table
CREATE TABLE IF NOT EXISTS public.summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  file_url text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled')),
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- 5. RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Viewing policies
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (is_published = true OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Anyone can view quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Anyone can view summaries" ON public.summaries FOR SELECT USING (true);
CREATE POLICY "Students can view their own enrollments" ON public.enrollments FOR SELECT USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Admin management
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage summaries" ON public.summaries FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage enrollments" ON public.enrollments FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 6. Triggers
CREATE TRIGGER set_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_summaries_updated_at BEFORE UPDATE ON public.summaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
