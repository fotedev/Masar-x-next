-- Add missing columns to reviews table to support generic reviews
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS summary_id uuid REFERENCES summaries(id) ON DELETE CASCADE;

-- Update constraints if needed
-- (Optional) Add checks to ensure at least one target is set if that's the business rule, 
-- but for now we just add the columns to unblock the view creation.

CREATE INDEX IF NOT EXISTS idx_reviews_quiz_id ON reviews(quiz_id);
CREATE INDEX IF NOT EXISTS idx_reviews_summary_id ON reviews(summary_id);
