/*
  Migration: 20260118012150

  Create `course-materials` storage bucket with secure, idempotent setup
  and strict Row Level Security policies.
*/

-- Upsert the bucket so the migration is idempotent.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure RLS is enabled for storage.objects (table-level).
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies related to course-materials to avoid duplicates.
DROP POLICY IF EXISTS "Instructors can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Instructors can manage their course materials" ON storage.objects;
DROP POLICY IF EXISTS "Instructors can delete their course materials" ON storage.objects;
DROP POLICY IF EXISTS "Enrolled students can download course materials" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all course materials" ON storage.objects;

-- Policy: Instructors can INSERT into the bucket for their courses.
CREATE POLICY "Instructors can upload course materials"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = (storage.foldername(name))[1]::uuid
      AND public.courses.instructor_id = auth.uid()
    )
  );

-- Policy: Instructors can UPDATE their own course files (and must remain in same bucket/course).
CREATE POLICY "Instructors can manage their course materials"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = (storage.foldername(name))[1]::uuid
      AND public.courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = (storage.foldername(name))[1]::uuid
      AND public.courses.instructor_id = auth.uid()
    )
  );

-- Policy: Instructors can DELETE their own course files.
CREATE POLICY "Instructors can delete their course materials"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = (storage.foldername(name))[1]::uuid
      AND public.courses.instructor_id = auth.uid()
    )
  );

-- Policy: Enrolled students can SELECT (download) files for active enrollments.
CREATE POLICY "Enrolled students can download course materials"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE public.enrollments.course_id = (storage.foldername(name))[1]::uuid
      AND public.enrollments.student_id = auth.uid()
      AND public.enrollments.status = 'active'
    )
  );

-- Policy: Admins (records in public.admins) can perform all actions on bucket objects.
CREATE POLICY "Admins can manage all course materials"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  );

-- Notes:
-- - This migration is idempotent (upserts the bucket & drops/recreates policies).
-- - It scopes every policy to bucket_id = 'course-materials' to avoid cross-bucket access.
-- - storage.foldername(name) is used to extract course id from object path; ensure your client
--   stores files under "<course_id>/..." inside the bucket.
 