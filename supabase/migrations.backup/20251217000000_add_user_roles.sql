/*
  # Add User Roles System

  ## Overview
  Adds role-based access control to distinguish between regular users and admins.
  Only users with admin role should have access to the admin dashboard.

  ## Changes
  - Add role column to user metadata
  - Create default admin user
  - Update RLS policies if needed
*/

-- Add role to user metadata (using raw_user_meta_data)
-- First, let's create a function to safely update user metadata
CREATE OR REPLACE FUNCTION set_user_role(user_id uuid, new_role text)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set the existing user as admin
SELECT set_user_role('5dbf1f0f-e40b-484f-94d1-731087bab814', 'admin');

-- Create a view for easier role checking
CREATE OR REPLACE VIEW user_roles AS
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at,
  email_confirmed_at
FROM auth.users;

-- Grant access to the view for authenticated users
GRANT SELECT ON user_roles TO authenticated;

-- Optional: Create an admins table for better management
CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz DEFAULT now(),
  notes text
);

-- Enable RLS on admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only admins can view the admins table
CREATE POLICY "Admins can view admins table" ON admins
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admins can insert into admins table
CREATE POLICY "Admins can manage admins" ON admins
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Add the existing admin user to the admins table
INSERT INTO admins (user_id, notes)
VALUES ('5dbf1f0f-e40b-484f-94d1-731087bab814', 'Initial admin user')
ON CONFLICT (user_id) DO NOTHING;
