-- =============================================================================
-- 014: Password Reset Token Hardening
-- Source: Security audit 2026-09-24, finding F5 (plaintext reset tokens stored
--         alongside their SHA-256 hash, defeating the hashing).
-- Safe to re-run: all statements are idempotent.
-- =============================================================================

-- 1) The legacy plaintext column must accept NULLs — the edge function no
--    longer sends it. (UNIQUE constraint stays; Postgres allows many NULLs.)
ALTER TABLE public.password_reset_tokens
  ALTER COLUMN token DROP NOT NULL;

-- 2) Wipe every previously stored plaintext token.
UPDATE public.password_reset_tokens
  SET token = NULL
  WHERE token IS NOT NULL;

-- 3) Invalidate all outstanding (unused, unexpired) tokens issued before this
--    hardening, forcing affected users to re-request a reset under the new
--    hash-only scheme.
UPDATE public.password_reset_tokens
  SET expires_at = now()
  WHERE used_at IS NULL
    AND expires_at > now();
