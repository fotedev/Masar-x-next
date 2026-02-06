/*
  # Add Display Name Field

  ## Overview
  Adds display_name field to user metadata for custom display names.

  ## Changes
  - Add display_name to user metadata
  - Set default display names for existing users
*/

-- Set display names for existing users based on their email
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', split_part(email, '@', 1))
WHERE raw_user_meta_data->>'display_name' IS NULL;

-- Create a view for easier access to user display names
CREATE OR REPLACE VIEW user_profiles AS
SELECT
  id,
  email,
  raw_user_meta_data->>'display_name' as display_name,
  created_at,
  email_confirmed_at
FROM auth.users;
