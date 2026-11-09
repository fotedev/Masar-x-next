-- Storage policy lockdown — full-code review 2026-11-07 (D8 🔴: anonymous
-- INSERT/SELECT on every bucket, unscoped authenticated DELETE).
--
-- Legitimate app usage verified against the codebase (apps/web, apps/mobile,
-- supabase/functions — the edge functions use zero Supabase Storage; all
-- media goes to Cloudinary):
--   summaries-pdfs   upload + getPublicUrl, authenticated (useEditSummary.ts:119)
--   payment-proofs   student upload to "{uid}/{courseId}/…", instructor/admin
--                    signed-URL read (courses/[courseId]/page.tsx:257, EnrollmentsTab.tsx:28)
--   course-materials getPublicUrl download, authenticated (courses/[courseId]/page.tsx:458)
--   quiz-images      public bucket, unused by app code (Cloudinary is used instead)
--   Videos           private bucket, unused by app code
-- No app code deletes storage objects (no `.remove(` anywhere) — the unscoped
-- DELETE policy is dropped without replacement.

-- 1) Drop the four wide-open policies from the baseline (note: the INSERT
--    policy name contains a double space, verbatim from the baseline).
DROP POLICY IF EXISTS "Allow anyone to upload  1xwkmju_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow anyone to view PDFs 1xwkmju_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete PDFs 1xwkmju_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete PDFs 1xwkmju_1" ON storage.objects;

-- 2) summaries-pdfs: authenticated users may upload PDFs into the summaries/
--    folder. The bucket is public, so getPublicUrl display needs no policy.
CREATE POLICY "summaries_pdfs_insert_authenticated" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'summaries-pdfs'
  AND (storage.foldername(name))[1] = 'summaries'
);

-- 3) payment-proofs: students upload into their own "{uid}/{courseId}/…"
--    folder; owner, admins, and the owning course's instructor may read
--    (createSignedUrl requires SELECT).
CREATE POLICY "payment_proofs_insert_own_folder" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "payment_proofs_read_owner_or_reviewer" ON storage.objects
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.instructor_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[2]
    )
  )
);

-- 4) course-materials: authenticated read — preserves the current download
--    UX. Per-enrollment scoping needs a stable path convention and is a
--    documented follow-up (spec 040 §out-of-scope).
CREATE POLICY "course_materials_read_authenticated" ON storage.objects
AS PERMISSIVE FOR SELECT TO authenticated
USING (bucket_id = 'course-materials');
