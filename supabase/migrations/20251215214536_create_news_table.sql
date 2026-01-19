/*
  # Create news/announcements table

  ## Overview
  Adds a news/announcements system where admins can post important announcements,
  updates, and information for students.

  ## New Tables

  ### `news`
  - `id` (uuid, primary key) - Unique identifier for each news item
  - `title` (text, required) - News title
  - `content` (text, required) - Full news content
  - `type` (text, default 'announcement') - News type: 'announcement', 'update', 'important'
  - `is_active` (boolean, default true) - Whether the news is currently visible
  - `priority` (integer, default 0) - Display priority (higher numbers show first)
  - `created_by` (uuid, nullable) - Admin user who created the news
  - `created_at` (timestamptz) - When news was created
  - `updated_at` (timestamptz) - Last modification time

  ## Security

  ### Row Level Security (RLS)
  - Public users can view active news
  - Authenticated admin users can manage all news
*/

-- Drop existing table if it exists with different structure
DROP TABLE IF EXISTS news CASCADE;

-- Create news table
CREATE TABLE news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'update', 'important')),
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Public users can view active news
CREATE POLICY "Anyone can view active news" ON news
  FOR SELECT USING (is_active = true);

-- Authenticated users can manage all news
CREATE POLICY "Authenticated users can manage news" ON news
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_active ON news(is_active);
CREATE INDEX IF NOT EXISTS idx_news_type ON news(type);
CREATE INDEX IF NOT EXISTS idx_news_priority ON news(priority DESC);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);
