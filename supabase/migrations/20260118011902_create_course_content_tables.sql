/*
  # Create course content tables

  ## Overview
  Creates tables for managing course content including summaries, videos, and files.

  ## New Tables

  ### `course_summaries`
  - `id` (uuid, primary key) - Unique identifier
  - `course_id` (uuid, required) - Foreign key to courses table
  - `title` (text, required) - Summary title
  - `content` (text, required) - Summary content
  - `order_index` (integer, default 0) - Display order
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `course_videos`
  - `id` (uuid, primary key) - Unique identifier
  - `course_id` (uuid, required) - Foreign key to courses table
  - `title` (text, required) - Video title
  - `description` (text, nullable) - Video description
  - `video_url` (text, required) - URL to video file
  - `language` (text, required) - 'ar' for Arabic, 'en' for English
  - `duration` (integer, nullable) - Video duration in seconds
  - `order_index` (integer, default 0) - Display order
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `course_files`
  - `id` (uuid, primary key) - Unique identifier
  - `course_id` (uuid, required) - Foreign key to courses table
  - `title` (text, required) - File title
  - `description` (text, nullable) - File description
  - `file_url` (text, required) - URL to file in storage
  - `file_type` (text, required) - MIME type of the file
  - `file_size` (bigint, nullable) - File size in bytes
  - `order_index` (integer, default 0) - Display order
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Instructors can manage content for their own courses
  - Admins can manage all course content
  - Enrolled students can view content for courses they're enrolled in
*/

-- Create course_summaries table
CREATE TABLE IF NOT EXISTS course_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create course_videos table
CREATE TABLE IF NOT EXISTS course_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  language text NOT NULL CHECK (language IN ('ar', 'en')),
  duration integer,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create course_files table
CREATE TABLE IF NOT EXISTS course_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE course_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_files ENABLE ROW LEVEL SECURITY;

-- Course Summaries Policies

-- Instructors can view summaries for their courses
CREATE POLICY "Instructors can view summaries for their courses"
  ON course_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_summaries.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can view all summaries
CREATE POLICY "Admins can view all summaries"
  ON course_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Enrolled students can view summaries for courses they're enrolled in
CREATE POLICY "Enrolled students can view course summaries"
  ON course_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = course_summaries.course_id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'active'
    )
  );

-- Instructors can create summaries for their courses
CREATE POLICY "Instructors can create summaries"
  ON course_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_summaries.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Instructors can update summaries for their courses
CREATE POLICY "Instructors can update summaries"
  ON course_summaries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_summaries.course_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_summaries.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can update any summary
CREATE POLICY "Admins can update any summary"
  ON course_summaries
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

-- Instructors can delete summaries for their courses
CREATE POLICY "Instructors can delete summaries"
  ON course_summaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_summaries.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can delete any summary
CREATE POLICY "Admins can delete any summary"
  ON course_summaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Course Videos Policies

-- Instructors can view videos for their courses
CREATE POLICY "Instructors can view videos for their courses"
  ON course_videos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_videos.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can view all videos
CREATE POLICY "Admins can view all videos"
  ON course_videos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Enrolled students can view videos for courses they're enrolled in
CREATE POLICY "Enrolled students can view course videos"
  ON course_videos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = course_videos.course_id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'active'
    )
  );

-- Instructors can create videos for their courses
CREATE POLICY "Instructors can create videos"
  ON course_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_videos.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Instructors can update videos for their courses
CREATE POLICY "Instructors can update videos"
  ON course_videos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_videos.course_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_videos.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can update any video
CREATE POLICY "Admins can update any video"
  ON course_videos
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

-- Instructors can delete videos for their courses
CREATE POLICY "Instructors can delete videos"
  ON course_videos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_videos.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can delete any video
CREATE POLICY "Admins can delete any video"
  ON course_videos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Course Files Policies

-- Instructors can view files for their courses
CREATE POLICY "Instructors can view files for their courses"
  ON course_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_files.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can view all files
CREATE POLICY "Admins can view all files"
  ON course_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Enrolled students can view files for courses they're enrolled in
CREATE POLICY "Enrolled students can view course files"
  ON course_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = course_files.course_id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'active'
    )
  );

-- Instructors can create files for their courses
CREATE POLICY "Instructors can create files"
  ON course_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_files.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Instructors can update files for their courses
CREATE POLICY "Instructors can update files"
  ON course_files
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_files.course_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_files.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can update any file
CREATE POLICY "Admins can update any file"
  ON course_files
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

-- Instructors can delete files for their courses
CREATE POLICY "Instructors can delete files"
  ON course_files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_files.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Admins can delete any file
CREATE POLICY "Admins can delete any file"
  ON course_files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_summaries_course_id ON course_summaries(course_id);
CREATE INDEX IF NOT EXISTS idx_course_summaries_order_index ON course_summaries(order_index);
CREATE INDEX IF NOT EXISTS idx_course_videos_course_id ON course_videos(course_id);
CREATE INDEX IF NOT EXISTS idx_course_videos_language ON course_videos(language);
CREATE INDEX IF NOT EXISTS idx_course_videos_order_index ON course_videos(order_index);
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON course_files(course_id);
CREATE INDEX IF NOT EXISTS idx_course_files_order_index ON course_files(order_index);