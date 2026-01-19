-- Add Khaled "Leader" as admin user
-- Migration: 20260112211211_add_admin_user_khaled

-- First, find the user ID by email
DO $$
DECLARE
    target_user_id uuid;
    target_email text := 'ksabry797@gmail.com';
    target_display_name text := 'Khaled "Leader"';
BEGIN
    -- Get the user ID from the email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email;

    -- If user doesn't exist, raise an error
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % does not exist. Please create the user first through the signup process or Supabase dashboard.', target_email;
    END IF;

    -- Update user metadata to set role as admin and display name
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
                             jsonb_build_object('role', 'admin', 'display_name', target_display_name)
    WHERE id = target_user_id;

    -- Update or insert into profiles table
    INSERT INTO public.profiles (id, full_name)
    VALUES (target_user_id, target_display_name)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = timezone('utc'::text, now());

    -- Add user to admins table
    INSERT INTO admins (user_id, notes)
    VALUES (target_user_id, 'Added as admin user - Khaled "Leader"')
    ON CONFLICT (user_id) DO NOTHING;

    -- Log the action
    RAISE NOTICE 'Successfully added user % (%) as admin', target_email, target_display_name;
END $$;