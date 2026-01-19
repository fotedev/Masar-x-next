/*
  # Add user_id column to summaries table

  ## Overview
  Adds user_id column to track who created each summary for proper ownership and editing permissions.

  ## Changes
  - Add user_id column (UUID, nullable for existing records)
  - Add foreign key constraint to auth.users(id)
  - Update RLS policies to allow users to edit their own summaries
*/

-- Add user_id column to summaries table
ALTER TABLE summaries ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON summaries(user_id);

-- Update RLS policies for summaries table
DROP POLICY IF EXISTS "Authenticated users can update summaries" ON summaries;
DROP POLICY IF EXISTS "Authenticated users can delete summaries" ON summaries;

-- Allow users to update their own summaries
CREATE POLICY "Users can update their own summaries"
  ON summaries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own summaries
CREATE POLICY "Users can delete their own summaries"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to update any summary
CREATE POLICY "Admins can update any summary"
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

-- Allow admins to delete any summary
CREATE POLICY "Admins can delete any summary"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Update insert policy to include user_id requirement
DROP POLICY IF EXISTS "Anyone can submit summaries" ON summaries;
CREATE POLICY "Authenticated users can submit summaries"
  ON summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');