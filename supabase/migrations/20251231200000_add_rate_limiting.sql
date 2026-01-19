-- Rate Limiting Tables for Security
-- Protects against DoS, brute force, and API abuse

-- Rate limiting table for tracking requests
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- user_id or IP address
  endpoint text NOT NULL, -- API endpoint/function name
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint_window
ON rate_limits(identifier, endpoint, window_start);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
ON rate_limits(window_start);

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer DEFAULT 10,
  p_window_minutes integer DEFAULT 1
) RETURNS boolean AS $$
DECLARE
  current_count integer;
  window_cutoff timestamptz;
BEGIN
  -- Calculate window cutoff
  window_cutoff := now() - (p_window_minutes || ' minutes')::interval;

  -- Clean up old entries for this identifier/endpoint
  DELETE FROM rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start < window_cutoff;

  -- Get current count
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start >= window_cutoff;

  -- Check if limit exceeded
  IF current_count >= p_max_requests THEN
    RETURN false;
  END IF;

  -- Insert or update the counter
  INSERT INTO rate_limits (identifier, endpoint, request_count, window_start, updated_at)
  VALUES (p_identifier, p_endpoint, 1, now(), now())
  ON CONFLICT (identifier, endpoint)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1,
    updated_at = now()
  WHERE rate_limits.window_start >= window_cutoff;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on rate_limits table
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: only service role can manage rate limits (for security)
CREATE POLICY "Service role can manage rate limits"
ON rate_limits
FOR ALL TO service_role
USING (true);

-- Cleanup job to remove old rate limit entries (run periodically)
-- This can be called by a cron job or scheduled function
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  -- Remove entries older than 24 hours
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
