-- Add status column to quizzes table (if not exists)
-- Note: status column is now created in the base quizzes table creation migration

-- Update the view to include the new column (if it doesn't automatically)
-- Usually views defined with SELECT * will need to be recreated to pick up new columns
DROP VIEW IF EXISTS quizzes_with_ratings;

CREATE VIEW quizzes_with_ratings AS
SELECT 
  q.*,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as reviews_count
FROM quizzes q
LEFT JOIN reviews r ON q.id = r.quiz_id
GROUP BY q.id;
