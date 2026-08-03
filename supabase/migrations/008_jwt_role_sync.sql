-- Trigger to sync user role from admins table to auth.users app_metadata
-- This allows Middleware to read roles directly from the JWT without DB hits.

CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS trigger AS $$
BEGIN
  -- Update app_metadata in auth.users
  -- We use security definer to allow updates to auth schema
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for inserts or updates on admins table
DROP TRIGGER IF EXISTS on_admin_upsert ON public.admins;
CREATE TRIGGER on_admin_upsert
  AFTER INSERT OR UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_metadata();

-- Trigger for deletions (remove role from metadata)
CREATE OR REPLACE FUNCTION public.remove_user_role_from_metadata()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
  WHERE id = OLD.user_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_admin_delete ON public.admins;
CREATE TRIGGER on_admin_delete
  AFTER DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.remove_user_role_from_metadata();
