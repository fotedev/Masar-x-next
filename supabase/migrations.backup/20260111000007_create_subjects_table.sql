/*
  # Create subjects table for academic subjects

  ## Overview
  Creates the subjects table containing predefined academic subjects for the platform.

  ## New Tables

  ### `subjects`
  - `id` (uuid, primary key) - Unique identifier for each subject
  - `name` (text, required) - Subject name in Arabic
  - `created_at` (timestamptz) - When subject was created

  ## Predefined Subjects
  The following subjects are inserted:
  - أساسيات تكنولوجيا المعلومات
  - الرسم باليد
  - سلوكيات الهيئات
  - فيزياء 1
  - رياضيات 1
  - حقوق الإنسان
  - الكترونيات
  - لغة انجليزية
  - ثقافه اسلامية
  - تفكير علمي
  - اساسيات الرياضيات

  ## Security

  ### Row Level Security (RLS)
  - Enabled on all tables
  - Read-only access for all authenticated users
  - Only admins can modify subjects
*/

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view subjects
CREATE POLICY "Anyone can view subjects"
  ON subjects
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert new subjects
CREATE POLICY "Admins can insert subjects"
  ON subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Admins can update subjects
CREATE POLICY "Admins can update subjects"
  ON subjects
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

-- Admins can delete subjects
CREATE POLICY "Admins can delete subjects"
  ON subjects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Insert predefined subjects
INSERT INTO subjects (name) VALUES
  ('أساسيات تكنولوجيا المعلومات'),
  ('الرسم باليد'),
  ('سلوكيات الهيئات'),
  ('فيزياء 1'),
  ('رياضيات 1'),
  ('حقوق الإنسان'),
  ('الكترونيات'),
  ('لغة انجليزية'),
  ('ثقافه اسلامية'),
  ('تفكير علمي'),
  ('اساسيات الرياضيات')
ON CONFLICT (name) DO NOTHING;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);