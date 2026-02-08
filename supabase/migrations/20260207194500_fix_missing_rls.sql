-- Fix for missing RLS policies
-- 1. audit_logs
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their enrollment audit logs" ON public.audit_logs;
CREATE POLICY "Students can view their enrollment audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    changed_data->>'student_id' = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.id::text = changed_data->>'enrollment_id'
      AND enrollments.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can view audit logs for their courses" ON public.audit_logs;
CREATE POLICY "Instructors can view audit logs for their courses"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = changed_data->>'course_id'
      AND courses.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
    )
  );


-- 2. enrollments
ALTER TABLE IF EXISTS public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.enrollments;
CREATE POLICY "Students can view their own enrollments"
  ON public.enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Instructors can view enrollments for their courses" ON public.enrollments;
CREATE POLICY "Instructors can view enrollments for their courses"
  ON public.enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON public.enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can create enrollments" ON public.enrollments;
CREATE POLICY "Students can create enrollments"
  ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id AND status = 'pending');

DROP POLICY IF EXISTS "Instructors can approve enrollments for their courses" ON public.enrollments;
CREATE POLICY "Instructors can approve enrollments for their courses"
  ON public.enrollments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    ) AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    ) AND status IN ('active', 'expired')
  );

DROP POLICY IF EXISTS "Admins can update any enrollment" ON public.enrollments;
CREATE POLICY "Admins can update any enrollment"
  ON public.enrollments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can delete their own pending enrollments" ON public.enrollments;
CREATE POLICY "Students can delete their own pending enrollments"
  ON public.enrollments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id AND status = 'pending');

DROP POLICY IF EXISTS "Instructors can delete enrollments for their courses" ON public.enrollments;
CREATE POLICY "Instructors can delete enrollments for their courses"
  ON public.enrollments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete any enrollment" ON public.enrollments;
CREATE POLICY "Admins can delete any enrollment"
  ON public.enrollments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.user_id = auth.uid()
    )
  );


-- 3. quiz_answers
ALTER TABLE IF EXISTS public.quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own answers" ON public.quiz_answers;
CREATE POLICY "Users can view their own answers" ON public.quiz_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = quiz_answers.attempt_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own answers" ON public.quiz_answers;
CREATE POLICY "Users can insert their own answers" ON public.quiz_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = attempt_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own answers" ON public.quiz_answers;
CREATE POLICY "Users can update their own answers" ON public.quiz_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts
            WHERE id = attempt_id AND user_id = auth.uid()
        )
    );
