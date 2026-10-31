/*
  # Create subject_lectures table

  Stores explicitly created lectures per subject so admins can add lecture shells
  even if no content exists yet.
*/

CREATE TABLE IF NOT EXISTS subject_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  lecture_key text NOT NULL,
  lecture_label text NOT NULL,
  order_index integer NOT NULL DEFAULT 999999,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject, lecture_key)
);

ALTER TABLE subject_lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subject lectures"
  ON subject_lectures
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert subject lectures"
  ON subject_lectures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update subject lectures"
  ON subject_lectures
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

CREATE POLICY "Admins can delete subject lectures"
  ON subject_lectures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_subject_lectures_subject ON subject_lectures(subject);
CREATE INDEX IF NOT EXISTS idx_subject_lectures_order_index ON subject_lectures(order_index);
