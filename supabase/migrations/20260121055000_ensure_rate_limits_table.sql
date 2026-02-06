-- Migration: 20260121055000_ensure_rate_limits_table.sql
-- Purpose: Ensure rate_limits table, unique index and RLS policy exist (idempotent).

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rate_limits_identifier_endpoint
  ON public.rate_limits(identifier, endpoint);

ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true);

-- Notes:
-- - This migration is idempotent and safe to run on environments where the original
--   rate_limits table may be missing.
-- - The original functions (check_rate_limit, cleanup_rate_limits) are expected
--   to exist in another migration; if not, consider adding them here as well.

