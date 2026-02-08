-- Add avatar_url column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.avatar_url IS 'URL of user profile avatar image stored in Cloudinary';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_url ON profiles(avatar_url);