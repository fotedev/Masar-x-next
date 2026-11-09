-- ============================================================================
-- prelude.sql - MasarX local-PostgreSQL platform prelude (spec 040)
-- Recreates the lost spec 031 `tools/prelude.sql` artifact: the minimal
-- Supabase-platform emulation a vanilla PostgreSQL 17 needs before the
-- migration chain applies. The baseline itself creates the `storage` schema
-- (tables + functions); this prelude only provides the `auth` schema that
-- public-schema objects reference (`auth.users` FKs, `auth.uid()`,
-- `auth.role()`, `auth.jwt()`).
--
-- Idempotent and guarded: on a real Supabase project every statement here is
-- a no-op (the platform owns `auth`), so the file is safe to run anywhere.
--
-- Usage (see migrations/README.md):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -c "create role anon nologin; ..."
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/prelude.sql
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261031000000_baseline.sql
--   ... (rest of the chain, lexical order)
-- ============================================================================

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  -- FK target for profiles.id, analytics.user_id, etc. The rebuilt DB has
  -- no on_auth_user_created trigger (auth is platform-owned on Supabase).
  CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY,
    aud varchar(255),
    role varchar(255),
    email varchar(255),
    encrypted_password varchar(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token_new varchar(255),
    email_change_token_status varchar(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb DEFAULT '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_factor_meta_data jsonb DEFAULT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    phone varchar(15) DEFAULT NULL,
    phone_confirmed_at timestamptz DEFAULT NULL,
    phone_change varchar(15) DEFAULT '',
    phone_change_token varchar(255) DEFAULT '',
    phone_change_sent_at timestamptz DEFAULT NULL,
    email_change varchar(255) DEFAULT '',
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz DEFAULT NULL,
    reauthentication_token varchar(255) DEFAULT '',
    deleted_at timestamptz DEFAULT NULL,
    is_sso_user boolean NOT NULL DEFAULT false,
    is_anonymous boolean NOT NULL DEFAULT false,
    secret_factors boolean NOT NULL DEFAULT false
  );

  -- auth.uid(): the JWT subject from request.jwt.claims (platform contract).
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $inner$
        SELECT CASE
          WHEN COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN NULL
          ELSE NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
        END
      $inner$;
    $fn$;
  END IF;

  -- auth.role(): the JWT role claim.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'role'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text
      LANGUAGE sql STABLE AS $inner$
        SELECT CASE
          WHEN COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN NULL
          ELSE current_setting('request.jwt.claims', true)::jsonb ->> 'role'
        END
      $inner$;
    $fn$;
  END IF;

  -- auth.jwt(): the raw claims object.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'jwt'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
      LANGUAGE sql STABLE AS $inner$
        SELECT CASE
          WHEN COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN NULL
          ELSE current_setting('request.jwt.claims', true)::jsonb
        END
      $inner$;
    $fn$;
  END IF;
END
$outer$;
