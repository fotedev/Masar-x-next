/*
  # Create reviews table for course ratings and feedback

  ## Overview
  Creates the reviews table to allow enrolled students to rate and review courses.

  ## New Tables

  ### `reviews`
  - `id` (uuid, primary key) - Unique identifier for each review
  - `student_id` (uuid, required) - Foreign key to auth.users(id) - who wrote the review
  - `course_id` (uuid, required) - Foreign key to courses(id) - which course is reviewed
  - `rating` (integer, nullable) - Rating from 1-5 stars
  - `comment` (text, nullable) - Review comment/text
  - `created_at` (timestamptz) - When review was posted
  - `updated_at` (timestamptz) - Last modification time

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Only students with active enrollments can create reviews
  - Anyone can view reviews
  - Students can edit/delete their own reviews
  - Admins can manage all reviews
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id) -- One review per student per course
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews (for course pages and reputation building)
CREATE POLICY "Anyone can view reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Students with active enrollments can create reviews
CREATE POLICY "Students with active enrollments can create reviews"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.student_id = auth.uid()
      AND enrollments.course_id = reviews.course_id
      AND enrollments.status = 'active'
    )
  );

-- Students can update their own reviews
CREATE POLICY "Students can update their own reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Admins can update any review
CREATE POLICY "Admins can update any review"
  ON reviews
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

-- Students can delete their own reviews
CREATE POLICY "Students can delete their own reviews"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

-- Admins can delete any review
CREATE POLICY "Admins can delete any review"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course_id ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);