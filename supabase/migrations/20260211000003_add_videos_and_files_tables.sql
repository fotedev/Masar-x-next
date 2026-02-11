/*
  Add videos and files tables for subject content

  - videos: Store video links/URLs for subjects
  - files: Store file uploads for subjects
*/

-- Create videos table
CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  language text CHECK (language IN ('ar', 'en')),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view videos
CREATE POLICY "Anyone can view videos"
  ON videos
  FOR SELECT
  TO authenticated
  USING (true);

-- Instructors/admins can insert videos
CREATE POLICY "Instructors can insert videos"
  ON videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Instructors/admins can update videos
CREATE POLICY "Instructors can update videos"
  ON videos
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

-- Instructors/admins can delete videos
CREATE POLICY "Instructors can delete videos"
  ON videos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create files table
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on files
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view files
CREATE POLICY "Anyone can view files"
  ON files
  FOR SELECT
  TO authenticated
  USING (true);

-- Instructors/admins can insert files
CREATE POLICY "Instructors can insert files"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Instructors/admins can update files
CREATE POLICY "Instructors can update files"
  ON files
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

-- Instructors/admins can delete files
CREATE POLICY "Instructors can delete files"
  ON files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_videos_subject ON videos(subject);
CREATE INDEX idx_files_subject ON files(subject);
