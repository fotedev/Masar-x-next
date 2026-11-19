-- Strip the "(حقيقي)" suffix from the seeded real-exam quiz titles and
-- replace the internal build-note text inside the JSON-encoded description
-- envelope with a neutral Arabic line (subject-preserving).
--
-- Prod-applied via Supabase MCP on 2026-11-19: 16 title edits + 17
-- description rewrites. The rows themselves are prod-only data seeded by
-- the withdrawn spec-033 seed SQL (spec 043 purged it from history; the
-- rows were kept by owner decision) — this migration documents and
-- reproduces the cleanup for any chain replay. Idempotent: re-running
-- matches nothing.

UPDATE quizzes
SET title = regexp_replace(title, '\s*\(حقيقي\)$', '')
WHERE title LIKE '% (حقيقي)';

UPDATE quizzes
SET description = jsonb_set(
  description::jsonb,
  '{description}',
  to_jsonb('أسئلة تدريبية على محتوى مادة ' || coalesce(description::jsonb->>'subject', 'المادة'))
)::text
WHERE description LIKE '%Real questions extracted%'
  AND left(description, 1) = '{';
