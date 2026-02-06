/*
  # Create enrollments table for course subscriptions

  ## Overview
  Creates the enrollments table to manage student course subscriptions and payment verification.

  ## New Tables

  ### `enrollments`
  - `id` (uuid, primary key) - Unique identifier for each enrollment
  - `student_id` (uuid, required) - Foreign key to auth.users(id) - who enrolled
  - `course_id` (uuid, required) - Foreign key to courses(id) - which course
  - `status` (text, required) - Enrollment status: 'pending', 'active', 'expired'
  - `payment_screenshot_url` (text, nullable) - URL to payment screenshot in Supabase Storage
  - `created_at` (timestamptz) - When enrollment was requested
  - `updated_at` (timestamptz) - Last modification time

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Students can view and create their own enrollments
  - Instructors can view enrollments for their courses and approve pending ones
  - Admins can manage all enrollments
*/

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired')),
  payment_screenshot_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id) -- Prevent duplicate enrollments
);

-- Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "Students can view their own enrollments"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Instructors can view enrollments for their courses
CREATE POLICY "Instructors can view enrollments for their courses"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can view all enrollments
CREATE POLICY "Admins can view all enrollments"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Students can create enrollments for themselves
CREATE POLICY "Students can create enrollments"
  ON enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id AND status = 'pending');

-- Instructors can approve enrollments for their courses (change status to 'active')
CREATE POLICY "Instructors can approve enrollments for their courses"
  ON enrollments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    ) AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    ) AND status IN ('active', 'expired')
  );

-- Admins can update any enrollment
CREATE POLICY "Admins can update any enrollment"
  ON enrollments
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

-- Students can delete their own pending enrollments
CREATE POLICY "Students can delete their own pending enrollments"
  ON enrollments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id AND status = 'pending');

-- Instructors can delete enrollments for their courses
CREATE POLICY "Instructors can delete enrollments for their courses"
  ON enrollments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can delete any enrollment
CREATE POLICY "Admins can delete any enrollment"
  ON enrollments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON enrollments(created_at DESC);