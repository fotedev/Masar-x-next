-- 012_jwt_role_sync (applied to production 2026-09-20, name: jwt_role_sync)
--
-- Deploys the 008_jwt_role_sync design that was NEVER applied to prod (G3.9 drift,
-- discovered during the S5 role-invalidation validation: prod had no
-- on_admin_upsert / on_admin_delete triggers on public.admins, so grants produced no
-- app_metadata.role claim and revocations stripped nothing; one live student_admin
-- had no claim and a dead admin UI). Adds the triggers plus a one-time backfill that
-- aligns every user's claim with the admins table (source of truth).
--
-- Backfill impact verified live before apply: cfb0ecb2… claim admin->doctor (matches
-- row); c490f174… claim null->student_admin (restores admin UI); zero orphan claims.

CREATE OR REPLACE FUNCTION public.sync_user_role_to_metadata()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_admin_upsert ON public.admins;
CREATE TRIGGER on_admin_upsert
  AFTER INSERT OR UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_metadata();

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

-- One-time backfill: align every admin's claim with the admins table (source of truth).
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) - 'role' || jsonb_build_object('role', a.role)
FROM public.admins a
WHERE a.user_id = u.id
  AND COALESCE(u.raw_app_meta_data->>'role', '') IS DISTINCT FROM a.role;

-- One-time backfill: strip claims from users who no longer (or never) have an admins row.
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) - 'role'
WHERE u.raw_app_meta_data->>'role' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = u.id);
