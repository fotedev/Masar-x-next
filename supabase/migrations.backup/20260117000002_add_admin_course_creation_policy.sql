/*
  # Add admin course creation policy

  ## Overview
  Adds a Row Level Security policy to allow admins to create courses. This addresses the issue where admins can manage existing courses but cannot create new ones.

  ## Changes
  - Add policy "Admins can create courses" to allow admins to insert into courses table
*/

-- Allow admins to create courses
CREATE POLICY "Admins can create courses"
  ON courses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );