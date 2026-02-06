/*
  # Create storage bucket for PDF uploads

  ## Overview
  Sets up Supabase Storage bucket for PDF file uploads with appropriate security policies.

  ## Storage
  
  ### `summaries-pdfs` bucket
  - Public bucket for storing PDF files
  - Anyone can upload PDFs
  - Anyone can view/download PDFs
  - Only authenticated users (admins) can delete files

  ## Security
  - Public read access for all files
  - Public insert/upload access (for anonymous submissions)
  - Delete access restricted to authenticated users only
*/

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('summaries-pdfs', 'summaries-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload PDFs
CREATE POLICY "Anyone can upload PDFs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'summaries-pdfs');

-- Allow anyone to view/download PDFs
CREATE POLICY "Anyone can view PDFs"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'summaries-pdfs');

-- Only authenticated users can delete PDFs
CREATE POLICY "Authenticated users can delete PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'summaries-pdfs');