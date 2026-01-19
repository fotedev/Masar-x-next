/*
  # Strict RLS Policy for Enrollments

  ## Overview
  Updates the RLS policies for the enrollments table to strictly enforce that only the instructor
  of the course can modify the enrollment status. This removes the general admin update capability
  for this table to ensure transparency and accountability.

  ## Changes
  - Drop policy "Admins can update any enrollment"
  - Ensure "Instructors can approve enrollments for their courses" is the only policy allowing status updates
*/

-- Drop the admin update policy
DROP POLICY IF EXISTS "Admins can update any enrollment" ON enrollments;

-- Ensure the instructor policy is correct (it was created in 20260111000004)
-- "Instructors can approve enrollments for their courses"
-- ON enrollments
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM courses
--     WHERE courses.id = enrollments.course_id
--     AND courses.instructor_id = auth.uid()
--   ) AND status = 'pending'
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM courses
--     WHERE courses.id = enrollments.course_id
--     AND courses.instructor_id = auth.uid()
--   ) AND status IN ('active', 'expired')
-- );
