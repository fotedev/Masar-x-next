/*
  Temporarily disable RLS on platform_settings for local development
  WARNING: Remove this in production
*/

ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;
