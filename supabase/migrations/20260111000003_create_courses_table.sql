/*
  # Create courses table for instructor-led paid courses

  ## Overview
  Creates the courses table to support paid educational content provided by instructors.

  ## New Tables

  ### `courses`
  - `id` (uuid, primary key) - Unique identifier for each course
  - `title` (text, required) - Course title
  - `description` (text, nullable) - Course description
  - `instructor_id` (uuid, required) - Foreign key to auth.users(id) - who teaches this course
  - `price` (numeric, nullable) - Course price (can be null for free courses)
  - `is_published` (boolean, default false) - Whether the course is visible to students
  - `created_at` (timestamptz) - When course was created
  - `updated_at` (timestamptz) - Last modification time

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Instructors can create, update, and delete their own courses
  - Admins can manage all courses
  - Students can view published courses
*/

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Instructors can view their own courses
CREATE POLICY "Instructors can view their own courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = instructor_id);

-- Admins can view all courses
CREATE POLICY "Admins can view all courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Students can view published courses
CREATE POLICY "Students can view published courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Instructors can create their own courses
CREATE POLICY "Instructors can create courses"
  ON courses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = instructor_id);

-- Instructors can update their own courses
CREATE POLICY "Instructors can update their own courses"
  ON courses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

-- Admins can update any course
CREATE POLICY "Admins can update any course"
  ON courses
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

-- Instructors can delete their own courses
CREATE POLICY "Instructors can delete their own courses"
  ON courses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = instructor_id);

-- Admins can delete any course
CREATE POLICY "Admins can delete any course"
  ON courses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);