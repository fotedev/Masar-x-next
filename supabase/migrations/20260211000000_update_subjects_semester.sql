/*
  Add semester column to subjects if not exists, then update all subjects to semester 1 (first term)
*/

-- Add semester column if not exists
ALTER TABLE IF EXISTS subjects
  ADD COLUMN IF NOT EXISTS semester integer DEFAULT 1;

-- Update all subjects to semester 1
UPDATE subjects SET semester = 1 WHERE semester IS NULL OR semester != 1;
