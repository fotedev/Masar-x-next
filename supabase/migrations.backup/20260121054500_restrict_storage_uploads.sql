-- Restrict anonymous uploads to the 'summaries-pdfs' bucket
DROP POLICY IF EXISTS "Anyone can upload PDFs" ON storage.objects;

CREATE POLICY IF NOT EXISTS "Authenticated can upload PDFs"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'summaries-pdfs');
