-- Migration: 20260222033000_trw_complete_architecture.sql
-- Description: Implements the full TRW subsystem architecture including plan definitions, 
--              memberships, audit logs, and secure RLS policies.

-- 1. Create Plan Definitions
CREATE TABLE IF NOT EXISTS public.trw_plan_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Initial Plans
INSERT INTO public.trw_plan_definitions (slug, name, description, sort_order) VALUES
  ('free',        'Free Preview',     'Access to free preview content only',  0),
  ('full_access', 'Full TRW Access',  'Access to all TRW categories',         1),
  ('money_only',  'Money Category',   'Access to the money-making category',  2)
ON CONFLICT (slug) DO NOTHING;

-- 2. Create Categories (if not exists from previous migration)
-- Note: 20260220190304_create_trw_tables.sql might have created some of these.
-- We ensure the structure matches the new design.
CREATE TABLE IF NOT EXISTS public.trw_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_name    TEXT,
  cover_url    TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Plan-to-Category Mapping
CREATE TABLE IF NOT EXISTS public.trw_plan_category_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.trw_plan_definitions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.trw_categories(id) ON DELETE CASCADE,
  UNIQUE (plan_id, category_id)
);

-- 4. Memberships Table
CREATE TABLE IF NOT EXISTS public.trw_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id     UUID NOT NULL REFERENCES public.trw_plan_definitions(id) ON DELETE RESTRICT,
  granted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  revoked_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       TEXT,
  UNIQUE (user_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_trw_memberships_user_lookup
  ON public.trw_memberships (user_id, revoked_at, expires_at);

-- 5. Membership Audit Log
CREATE TABLE IF NOT EXISTS public.trw_membership_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES public.trw_memberships(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL,
  actor_id      UUID,
  action        TEXT NOT NULL CHECK (action IN ('granted', 'revoked', 'expired', 'renewed')),
  plan_slug     TEXT NOT NULL,
  notes         TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Access Codes (Supersedes system_access_codes)
CREATE TABLE IF NOT EXISTS public.trw_access_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  plan_id      UUID NOT NULL REFERENCES public.trw_plan_definitions(id) ON DELETE RESTRICT,
  max_uses     INTEGER NOT NULL DEFAULT 1,
  used_count   INTEGER NOT NULL DEFAULT 0 CHECK (used_count <= max_uses),
  expires_at   TIMESTAMPTZ,
  membership_duration_days INTEGER,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  description  TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_exhausted_active CHECK (NOT (used_count >= max_uses AND is_active = true))
);

-- 7. Access Code Redemptions
CREATE TABLE IF NOT EXISTS public.trw_access_code_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       UUID NOT NULL REFERENCES public.trw_access_codes(id) ON DELETE RESTRICT,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.trw_memberships(id) ON DELETE SET NULL,
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

-- 8. User Progress
CREATE TABLE IF NOT EXISTS public.trw_user_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id  UUID NOT NULL, -- Will reference trw_materials once created/verified
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_trw_user_progress_user ON public.trw_user_progress(user_id);

-- 9. Security Functions
CREATE OR REPLACE FUNCTION public.is_trw_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trw_memberships
    WHERE user_id   = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trw_member_for_category(p_category_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trw_memberships m
    JOIN public.trw_plan_category_access pca ON pca.plan_id = m.plan_id
    WHERE m.user_id    = auth.uid()
      AND m.revoked_at IS NULL
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND pca.category_id = p_category_id
  );
$$;

-- 10. Code Redemption Function
CREATE OR REPLACE FUNCTION public.trw_redeem_access_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code        public.trw_access_codes%ROWTYPE;
  v_plan        public.trw_plan_definitions%ROWTYPE;
  v_user_id     UUID := auth.uid();
  v_expires_at  TIMESTAMPTZ;
  v_membership  public.trw_memberships%ROWTYPE;
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock + fetch the code atomically
  SELECT * INTO v_code
  FROM public.trw_access_codes
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  -- Check for duplicate redemption
  IF EXISTS (
    SELECT 1 FROM public.trw_access_code_redemptions
    WHERE code_id = v_code.id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Compute membership expiry
  v_expires_at := CASE
    WHEN v_code.membership_duration_days IS NOT NULL
      THEN now() + (v_code.membership_duration_days || ' days')::INTERVAL
    ELSE NULL  -- Permanent
  END;

  -- Fetch plan
  SELECT * INTO v_plan FROM public.trw_plan_definitions WHERE id = v_code.plan_id;

  -- Upsert membership
  INSERT INTO public.trw_memberships (user_id, plan_id, granted_by, expires_at, notes)
  VALUES (v_user_id, v_code.plan_id, NULL, v_expires_at, 'Redeemed via code: ' || p_code)
  ON CONFLICT (user_id, plan_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        revoked_at = NULL,
        granted_at = now(),
        notes      = EXCLUDED.notes
  RETURNING * INTO v_membership;

  -- Record redemption
  INSERT INTO public.trw_access_code_redemptions (code_id, user_id, membership_id)
  VALUES (v_code.id, v_user_id, v_membership.id);

  -- Increment usage counter
  UPDATE public.trw_access_codes SET used_count = used_count + 1 WHERE id = v_code.id;

  -- Deactivate code if exhausted
  UPDATE public.trw_access_codes
  SET is_active = false
  WHERE id = v_code.id AND used_count >= max_uses;

  -- Write audit log
  INSERT INTO public.trw_membership_audit_log
    (membership_id, user_id, actor_id, action, plan_slug, notes)
  VALUES
    (v_membership.id, v_user_id, NULL, 'granted', v_plan.slug, 'Code redemption');

  RETURN jsonb_build_object(
    'success',    true,
    'plan_slug',  v_plan.slug,
    'expires_at', v_expires_at
  );
END;
$$;

-- 1) profiles: add level and semester for onboarding, plus show_extra_assets for TRW
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS semester integer,
  ADD COLUMN IF NOT EXISTS show_extra_assets boolean DEFAULT false;

-- Add RLS policy for profiles selection
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Ensure everyone can view basic profile info if needed, but specifically authenticated users for their own and others' show_extra_assets
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  TO public
  USING (true);


-- 11. RLS Policies

-- Categories
ALTER TABLE public.trw_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trw_categories_select_published" ON public.trw_categories;
CREATE POLICY "trw_categories_select_published"
  ON public.trw_categories FOR SELECT
  TO public
  USING (is_published = true);

-- Memberships
ALTER TABLE public.trw_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trw_memberships_select_own" ON public.trw_memberships;
CREATE POLICY "trw_memberships_select_own"
  ON public.trw_memberships FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Access Codes
ALTER TABLE public.trw_access_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trw_access_codes_select_auth" ON public.trw_access_codes;
CREATE POLICY "trw_access_codes_select_auth"
  ON public.trw_access_codes FOR SELECT
  TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- User Progress
ALTER TABLE public.trw_user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trw_user_progress_select_own" ON public.trw_user_progress;
CREATE POLICY "trw_user_progress_select_own"
  ON public.trw_user_progress FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trw_user_progress_insert_own" ON public.trw_user_progress;
CREATE POLICY "trw_user_progress_insert_own"
  ON public.trw_user_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_trw_member()
  );

-- 12. Migration of existing access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'show_extra_assets') THEN
    INSERT INTO public.trw_memberships (user_id, plan_id, notes)
    SELECT 
      p.id,
      (SELECT id FROM public.trw_plan_definitions WHERE slug = 'full_access'),
      'Migrated from legacy show_extra_assets flag'
    FROM public.profiles p
    WHERE p.show_extra_assets = true
    ON CONFLICT (user_id, plan_id) DO NOTHING;
  END IF;
END $$;
