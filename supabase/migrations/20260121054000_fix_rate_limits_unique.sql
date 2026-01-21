-- Add unique index to support ON CONFLICT in check_rate_limit
CREATE UNIQUE INDEX IF NOT EXISTS ux_rate_limits_identifier_endpoint
ON rate_limits(identifier, endpoint);
