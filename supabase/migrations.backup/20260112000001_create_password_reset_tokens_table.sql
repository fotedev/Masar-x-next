-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Create index for cleanup (expired tokens)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert tokens (for password reset requests)
CREATE POLICY "Anyone can insert password reset tokens"
  ON password_reset_tokens
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to select tokens (for verification)
CREATE POLICY "Anyone can read password reset tokens"
  ON password_reset_tokens
  FOR SELECT
  USING (true);

-- Allow service role to delete used tokens
CREATE POLICY "Service role can delete password reset tokens"
  ON password_reset_tokens
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Function to cleanup expired tokens (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW();
END;
$$;

-- Add comment
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for secure password recovery';