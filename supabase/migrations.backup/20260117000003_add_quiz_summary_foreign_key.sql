/*
  # Add foreign key constraint to quizzes table

  ## Overview
  Adds the foreign key constraint from quizzes.summary_id to summaries.id after both tables are created.

  ## Changes
  - Add foreign key constraint: quizzes.summary_id REFERENCES summaries(id) ON DELETE SET NULL
*/

-- Add foreign key constraint for summary_id
ALTER TABLE quizzes
ADD CONSTRAINT fk_quizzes_summary_id
FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE SET NULL;