/*
  # Update auth.users metadata structure documentation

  ## Overview
  Documents the expected metadata structure for user profiles in Supabase Auth.
  The actual metadata fields are managed through the Supabase Auth API and cannot be altered via SQL migrations.

  ## Expected User Metadata Fields
  These fields should be set in auth.users.raw_user_meta_data or auth.users.user_metadata:

  - `academic_level` (text) - User's academic level (e.g., "المستوى الأول")
  - `department` (text) - User's department (e.g., "ذكاء اصطناعي", "هندسة برمجيات", "علوم الحاسب")
  - `profile_image_url` (text) - URL to user's profile image in Supabase Storage

  ## Implementation Notes
  - These fields are set through the Supabase Auth updateUser() method
  - Frontend code should validate and set these fields during user onboarding
  - Default values should be applied if fields are missing
*/

-- This migration serves as documentation only
-- The actual metadata structure is managed by Supabase Auth
-- No database changes are made here

-- Create a function to get user profile data (for convenience)
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  user_record record;
  profile_data jsonb;
BEGIN
  -- Get user from auth.users
  SELECT * INTO user_record FROM auth.users WHERE id = user_uuid;

  IF user_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build profile data from metadata
  profile_data := jsonb_build_object(
    'id', user_record.id,
    'email', user_record.email,
    'display_name', COALESCE(
      user_record.raw_user_meta_data->>'display_name',
      user_record.raw_user_meta_data->>'name',
      user_record.user_metadata->>'display_name',
      user_record.user_metadata->>'name',
      split_part(user_record.email, '@', 1),
      'مستخدم'
    ),
    'academic_level', COALESCE(
      user_record.raw_user_meta_data->>'academic_level',
      user_record.user_metadata->>'academic_level',
      'المستوى الأول'
    ),
    'department', COALESCE(
      user_record.raw_user_meta_data->>'department',
      user_record.user_metadata->>'department'
    ),
    'profile_image_url', COALESCE(
      user_record.raw_user_meta_data->>'profile_image_url',
      user_record.user_metadata->>'profile_image_url'
    ),
    'created_at', user_record.created_at,
    'updated_at', user_record.updated_at
  );

  RETURN profile_data;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO authenticated;

-- Create a function to check if user has completed onboarding
CREATE OR REPLACE FUNCTION has_completed_onboarding(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  user_record record;
BEGIN
  SELECT * INTO user_record FROM auth.users WHERE id = user_uuid;

  IF user_record IS NULL THEN
    RETURN false;
  END IF;

  -- Check if required fields are present
  RETURN (
    (user_record.raw_user_meta_data->>'academic_level' IS NOT NULL OR
     user_record.user_metadata->>'academic_level' IS NOT NULL) AND
    (user_record.raw_user_meta_data->>'department' IS NOT NULL OR
     user_record.user_metadata->>'department' IS NOT NULL)
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION has_completed_onboarding(uuid) TO authenticated;