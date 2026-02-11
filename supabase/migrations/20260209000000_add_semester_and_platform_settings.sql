/*
  Add semester support to subjects and create platform_settings table

  - Adds `semester` column to `subjects` table (integer: 1 or 2). Default = 1.
  - Creates `platform_settings` table for global platform configuration.
  - Inserts default setting `active_semester = 1`.
*/

-- 1) Add semester column to subjects
ALTER TABLE IF EXISTS subjects
  ADD COLUMN IF NOT EXISTS semester integer DEFAULT 1;

-- Update index if needed (no-op if exists)
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester);

-- 2) Create platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on settings (follow existing pattern — only admins can modify)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can upsert platform settings"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
    )
  );

-- 3) Insert default active_semester setting
INSERT INTO platform_settings (key, value)
VALUES ('active_semester', jsonb_build_object('semester', 1))
ON CONFLICT (key) DO UPDATE SET value = platform_settings.value
WHERE platform_settings.key = 'active_semester';

