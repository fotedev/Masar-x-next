-- Ensure rate_limits exists before fix migration (timestamp 20260121053900)
-- Idempotent: creates table only if missing.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index used by check_rate_limit if not exists (safe to include)
CREATE UNIQUE INDEX IF NOT EXISTS ux_rate_limits_identifier_endpoint
  ON public.rate_limits(identifier, endpoint);

