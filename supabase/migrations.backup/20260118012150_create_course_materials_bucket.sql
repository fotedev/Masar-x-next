/*
  # Create course-materials storage bucket

  ## Overview
  Creates a secure storage bucket for course materials (files) uploaded by instructors.

  ## New Storage Bucket

  ### `course-materials`
  - Private bucket for course files (PDFs, documents, presentations, etc.)
  - Accessible only to enrolled students and course instructors
  - Supports file uploads up to 50MB
  - Accepts common educational file types

  ## Security

  ### Bucket Policies
  - Instructors can upload files to their own courses
  - Enrolled students can download files from courses they're enrolled in
  - Admins have full access to all course materials
  - Public access is denied
*/

-- Create the course-materials storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  false,
  52428800, -- 50MB in bytes
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
);

-- Enable RLS on storage.objects for course-materials bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Instructors can upload files to their courses
CREATE POLICY "Instructors can upload course materials"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = (storage.foldername(name))[1]::uuid
      AND courses.instructor_id = auth.uid()
    )
  );

-- Policy: Instructors can update/delete files from their courses
CREATE POLICY "Instructors can manage their course materials"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = (storage.foldername(name))[1]::uuid
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = (storage.foldername(name))[1]::uuid
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete their course materials"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = (storage.foldername(name))[1]::uuid
      AND courses.instructor_id = auth.uid()
    )
  );

-- Policy: Enrolled students can download course materials
CREATE POLICY "Enrolled students can download course materials"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = (storage.foldername(name))[1]::uuid
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'active'
    )
  );

-- Policy: Admins can manage all course materials
CREATE POLICY "Admins can manage all course materials"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'course-materials'
    AND EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );