-- 005_interactions_and_media.sql
-- 1. Videos Table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject text, -- Backward compatibility
  title text NOT NULL,
  url text NOT NULL,
  language text DEFAULT 'ar',
  user_id uuid REFERENCES auth.users(id),
  lecture_key text,
  lecture_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Files Table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject text, -- Backward compatibility
  title text NOT NULL,
  file_url text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Reviews Table (Incorporating Video Ratings Fix)
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  summary_id uuid REFERENCES public.summaries(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE, -- From SQL_FIX_VIDEOS_RATINGS.sql
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Views (Incorporating Video Ratings Fix)
CREATE OR REPLACE VIEW public.review_details WITH (security_invoker) AS
SELECT 
  r.id,
  r.rating,
  r.content as comment,
  r.user_id,
  r.summary_id,
  r.quiz_id,
  r.course_id,
  r.video_id,
  r.created_at,
  p.full_name as reviewer_name,
  p.avatar_url as reviewer_avatar
FROM public.reviews r
LEFT JOIN public.profiles p ON r.user_id = p.id;

CREATE OR REPLACE VIEW public.lectures_with_ratings WITH (security_invoker) AS
SELECT 
  v.id,
  v.subject,
  v.subject_id,
  v.title,
  v.url,
  v.language,
  v.user_id,
  v.created_at,
  v.lecture_key,
  v.lecture_id,
  ROUND(AVG(r.rating)::numeric, 1)::float as avg_rating,
  COUNT(r.id)::int as reviews_count
FROM public.videos v
LEFT JOIN public.reviews r ON v.id = r.video_id
GROUP BY v.id, v.subject, v.subject_id, v.title, v.url, v.language, v.user_id, v.created_at, v.lecture_key, v.lecture_id;

-- 5. RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Viewing policies
CREATE POLICY "Anyone can view videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Anyone can view files" ON public.files FOR SELECT USING (true);
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);

-- Management policies
CREATE POLICY "Admins can manage videos" ON public.videos FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage files" ON public.files FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- Review policies (from SQL_FIX_VIDEOS_RATINGS.sql)
CREATE POLICY "reviews_insert_quiz_summary_video"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND course_id IS NULL
    AND (quiz_id IS NOT NULL OR summary_id IS NOT NULL OR video_id IS NOT NULL)
  );

CREATE POLICY "reviews_insert_course_enrolled"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE student_id = auth.uid() AND course_id = reviews.course_id AND status = 'active'
    )
  );

CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Triggers
CREATE TRIGGER set_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
