/*
  # Final RLS Policy Review and Security Hardening

  ## Overview
  This migration performs a final review and hardening of all Row Level Security policies
  to ensure the subscription system maintains proper security and transparency.

  ## Key Security Requirements

  ### Enrollment Approval Security
  - Only course instructors can approve/reject enrollments for their courses
  - Admins cannot bypass this restriction in the application
  - All approval actions are logged in audit_logs

  ### Summary Ownership
  - Users can only edit/delete summaries they created
  - Admins can edit/delete any summary
  - Anonymous users cannot create summaries

  ### Course Management
  - Instructors can only manage their own courses
  - Admins can manage all courses

  ## Policy Verification
  This migration ensures all policies are correctly implemented and adds any missing restrictions.
*/

-- Final verification and hardening of enrollment policies
-- Ensure instructors can ONLY approve enrollments for their courses

-- Drop any existing policies that might be too permissive
DROP POLICY IF EXISTS "Admins can update any enrollment" ON enrollments;

-- Reinforce the strict policy: only instructors can change enrollment status
CREATE POLICY "Strict instructor-only enrollment approval"
  ON enrollments
  FOR UPDATE
  TO authenticated
  USING (
    -- Must be the instructor of the course
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
    -- And must be changing from pending to active/expired
    AND OLD.status = 'pending'
    AND NEW.status IN ('active', 'expired')
  )
  WITH CHECK (
    -- Must be the instructor of the course
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
    -- And must be changing from pending to active/expired
    AND OLD.status = 'pending'
    AND NEW.status IN ('active', 'expired')
  );

-- Ensure summary ownership is strictly enforced
-- Users can only modify their own summaries or admins can modify any

-- Verify the summary policies are correct
DROP POLICY IF EXISTS "Users can update their own summaries" ON summaries;
DROP POLICY IF EXISTS "Admins can update any summary" ON summaries;

CREATE POLICY "Strict summary ownership - users update own"
  ON summaries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Strict summary ownership - admins update any"
  ON summaries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Similar strict policies for deletion
DROP POLICY IF EXISTS "Users can delete their own summaries" ON summaries;
DROP POLICY IF EXISTS "Admins can delete any summary" ON summaries;

CREATE POLICY "Strict summary ownership - users delete own"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Strict summary ownership - admins delete any"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Ensure insert policy requires user_id to match authenticated user
DROP POLICY IF EXISTS "Authenticated users can submit summaries" ON summaries;

CREATE POLICY "Strict summary creation - user must be owner"
  ON summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- Add a security function to verify enrollment approval permissions
CREATE OR REPLACE FUNCTION can_approve_enrollment(enrollment_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY definer
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.id = enrollment_uuid
    AND c.instructor_id = user_uuid
    AND e.status = 'pending'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_approve_enrollment(uuid, uuid) TO authenticated;

-- Add comment documenting the security model
COMMENT ON TABLE enrollments IS 'Enrollment subscriptions with strict security: only course instructors can approve enrollments';
COMMENT ON TABLE summaries IS 'Study summaries with ownership: users can only edit their own summaries';
COMMENT ON TABLE audit_logs IS 'Complete audit trail for all enrollment changes to ensure transparency';