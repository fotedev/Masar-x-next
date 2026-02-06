-- Fix RLS policy for password reset tokens
-- Allow anonymous users to read tokens for verification

DROP POLICY IF EXISTS "Users can view their own reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Anonymous users can verify reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Anonymous users can read tokens by token value" ON password_reset_tokens;
DROP POLICY IF EXISTS "Service role can manage reset tokens" ON password_reset_tokens;

-- Allow anonymous users to read all tokens (needed for password reset flow)
CREATE POLICY "Anonymous users can read reset tokens" ON password_reset_tokens
  FOR SELECT TO anon USING (true);

-- Service role can do everything
CREATE POLICY "Service role can manage reset tokens" ON password_reset_tokens
  FOR ALL TO service_role USING (true);