/*
  # Create quizzes table

  ## Overview
  Creates the quizzes table to support AI-generated quizzes based on uploaded content.

  ## New Tables

  ### `quizzes`
  - `id` (uuid, primary key) - Unique identifier for each quiz
  - `title` (text, required) - Quiz title
  - `description` (text, nullable) - Quiz description
  - `content` (text, required) - Quiz content/questions
  - `user_id` (uuid, required) - Foreign key to auth.users(id) - who created this quiz
  - `summary_id` (uuid, nullable) - Foreign key to summaries table if quiz is based on a summary
  - `status` (text, default 'pending') - Quiz status: pending, approved, rejected
  - `created_at` (timestamptz) - When quiz was created
  - `updated_at` (timestamptz) - Last modification time
*/

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  content text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id uuid, -- Will be updated with foreign key after summaries table is created
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Users can view their own quizzes
CREATE POLICY "Users can view their own quizzes"
  ON quizzes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all quizzes
CREATE POLICY "Admins can view all quizzes"
  ON quizzes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Users can create their own quizzes
CREATE POLICY "Users can create quizzes"
  ON quizzes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own quizzes
CREATE POLICY "Users can update their own quizzes"
  ON quizzes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any quiz
CREATE POLICY "Admins can update any quiz"
  ON quizzes
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

-- Users can delete their own quizzes
CREATE POLICY "Users can delete their own quizzes"
  ON quizzes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can delete any quiz
CREATE POLICY "Admins can delete any quiz"
  ON quizzes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create view for quizzes with ratings
DROP VIEW IF EXISTS quizzes_with_ratings;
CREATE VIEW quizzes_with_ratings AS
SELECT
  q.*,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as reviews_count
FROM quizzes q
LEFT JOIN reviews r ON q.id = r.quiz_id
GROUP BY q.id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_summary_id ON quizzes(summary_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);