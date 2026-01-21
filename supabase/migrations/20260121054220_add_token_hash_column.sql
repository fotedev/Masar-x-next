-- Add token_hash column for secure password reset tokens
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Optional: index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
ON password_reset_tokens(token_hash);
