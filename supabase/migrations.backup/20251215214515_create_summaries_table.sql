/*
  # Create summaries platform database schema

  ## Overview
  Sets up the core database structure for the "Molkhas" (summary) platform where students can share study summaries.

  ## New Tables
  
  ### `summaries`
  - `id` (uuid, primary key) - Unique identifier for each summary
  - `title` (text, required) - Title of the summary
  - `subject` (text, required) - Subject/course name
  - `year` (text, required) - University year (e.g., "السنة الأولى", "السنة الثانية")
  - `department` (text, required) - Department/faculty (e.g., "هندسة", "طب")
  - `content` (text, required) - Main summary content (supports rich text/HTML)
  - `pdf_url` (text, nullable) - URL to uploaded PDF file in Supabase Storage
  - `contributor_name` (text, nullable) - Name of person who submitted (optional)
  - `status` (text, default 'pending') - Approval status: 'pending', 'approved', 'rejected'
  - `created_at` (timestamptz) - When summary was submitted
  - `updated_at` (timestamptz) - Last modification time

  ## Security
  
  ### Row Level Security (RLS)
  - Enabled on all tables
  - Public users can:
    - View approved summaries only
    - Submit new summaries (status defaults to pending)
  - Authenticated admin users can:
    - View all summaries regardless of status
    - Update any summary (change status, edit content)
    - Delete summaries
*/

-- Create summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL,
  year text NOT NULL,
  department text NOT NULL,
  content text NOT NULL,
  pdf_url text,
  contributor_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Public users can view approved summaries
CREATE POLICY "Anyone can view approved summaries"
  ON summaries
  FOR SELECT
  USING (status = 'approved');

-- Anyone can submit a new summary
CREATE POLICY "Anyone can submit summaries"
  ON summaries
  FOR INSERT
  WITH CHECK (status = 'pending');

-- Authenticated users can view all summaries (for admin dashboard)
CREATE POLICY "Authenticated users can view all summaries"
  ON summaries
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can update summaries (for moderation)
CREATE POLICY "Authenticated users can update summaries"
  ON summaries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete summaries
CREATE POLICY "Authenticated users can delete summaries"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_summaries_status ON summaries(status);
CREATE INDEX IF NOT EXISTS idx_summaries_subject ON summaries(subject);
CREATE INDEX IF NOT EXISTS idx_summaries_department ON summaries(department);
CREATE INDEX IF NOT EXISTS idx_summaries_year ON summaries(year);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at DESC);