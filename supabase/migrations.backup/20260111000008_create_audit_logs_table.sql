/*
  # Create audit_logs table for tracking enrollment changes

  ## Overview
  Creates the audit_logs table to track all changes to enrollments for transparency and security.
  This ensures instructors and students can verify that subscription approvals are properly recorded.

  ## New Tables

  ### `audit_logs`
  - `id` (uuid, primary key) - Unique identifier for each audit entry
  - `operation_name` (text, required) - Type of operation (e.g., 'enrollment_approved', 'enrollment_rejected')
  - `user_id` (uuid, required) - Foreign key to auth.users(id) - who performed the operation
  - `timestamp` (timestamptz, required) - When the operation occurred
  - `changed_data` (jsonb, required) - JSON data about what was changed (enrollment_id, old_status, new_status, etc.)

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Instructors can view audit logs for their courses
  - Admins can view all audit logs
  - Students can view audit logs related to their enrollments
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  changed_data jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Students can view audit logs related to their enrollments
CREATE POLICY "Students can view their enrollment audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    changed_data->>'student_id' = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.id::text = changed_data->>'enrollment_id'
      AND enrollments.student_id = auth.uid()
    )
  );

-- Instructors can view audit logs for their courses
CREATE POLICY "Instructors can view audit logs for their courses"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id::text = changed_data->>'course_id'
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Only the system can insert audit logs (via triggers)
-- No direct insert policy for users

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_name ON audit_logs(operation_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_data ON audit_logs USING gin(changed_data);