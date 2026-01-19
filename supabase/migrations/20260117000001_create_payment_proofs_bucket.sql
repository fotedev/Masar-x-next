/*
  # Create private storage bucket for payment proofs

  ## Overview
  Creates a private storage bucket for storing payment screenshots uploaded by students during course enrollment. Only course instructors can view the payment proofs for enrollments in their courses.

  ## Storage

  ### `payment-proofs` bucket
  - Private bucket for storing payment screenshot files
  - Students can upload payment proofs during enrollment
  - Only course instructors can view payment proofs for their courses
  - Only course instructors can delete payment proofs for their courses

  ## Security
  - Private bucket (not public)
  - RLS policies ensure instructors can only access payment proofs for courses they teach
  - Students can upload but cannot view others' payment proofs
*/

-- Create private storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Students can upload payment proofs
CREATE POLICY "Students can upload payment proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] IN (
      SELECT course_id::text
      FROM enrollments
      WHERE student_id = auth.uid()
      AND status IN ('pending', 'active')
    )
  );

-- Instructors can view payment proofs for their courses
CREATE POLICY "Instructors can view payment proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id::uuid
      WHERE e.student_id::text = (storage.foldername(name))[1]
      AND c.instructor_id = auth.uid()
      AND e.status IN ('pending', 'active', 'rejected')
    )
  );

-- Instructors can delete payment proofs for their courses
CREATE POLICY "Instructors can delete payment proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id::uuid
      WHERE e.student_id::text = (storage.foldername(name))[1]
      AND c.instructor_id = auth.uid()
      AND e.status IN ('pending', 'active', 'rejected')
    )
  );