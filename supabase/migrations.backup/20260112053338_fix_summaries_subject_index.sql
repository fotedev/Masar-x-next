-- Fix the subject index issue by replacing btree index with hash index
-- The btree index was failing because subject names were too long (>2704 bytes)

-- Drop the problematic btree index
DROP INDEX IF EXISTS idx_summaries_subject;

-- Create a hash index instead for better performance on equality lookups
-- Hash indexes are smaller and work better with long text values
CREATE INDEX IF NOT EXISTS idx_summaries_subject_hash ON summaries USING hash(subject);

-- Also add a partial index for approved summaries only (most common query)
CREATE INDEX IF NOT EXISTS idx_summaries_subject_approved ON summaries(subject)
WHERE status = 'approved';