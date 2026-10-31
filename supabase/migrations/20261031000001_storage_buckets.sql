-- ============================================================================
-- 20261031000001_storage_buckets.sql — storage bucket rows (data, not schema).
-- Complements the baseline schema snapshot: bucket rows live in
-- storage.buckets and are excluded from schema dumps. Idempotent.
-- Source: storage.buckets on production jcufigozkhxazjbwhjjm, 2026-10-31.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at) VALUES
  ('course-materials', 'course-materials', false, 52428800,
   '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip,application/x-rar-compressed,application/x-7z-compressed,image/jpeg,image/png,image/gif,image/webp}',
   '2026-01-18 03:14:35.321246+00', '2026-01-18 03:14:35.321246+00'),
  ('payment-proofs', 'payment-proofs', false, NULL, NULL,
   '2026-01-18 03:14:07.521216+00', '2026-01-18 03:14:07.521216+00'),
  ('quiz-images', 'quiz-images', true, NULL, NULL,
   '2026-01-16 07:17:51.568951+00', '2026-01-16 07:17:51.568951+00'),
  ('summaries-pdfs', 'summaries-pdfs', true, 10485760, NULL,
   '2025-12-15 23:57:13.742396+00', '2025-12-15 23:57:13.742396+00'),
  ('Videos', 'Videos', false, 41943040, NULL,
   '2026-01-18 02:09:14.210274+00', '2026-01-18 02:09:14.210274+00')
ON CONFLICT (id) DO NOTHING;
