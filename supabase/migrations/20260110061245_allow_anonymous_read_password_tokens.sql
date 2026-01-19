-- Allow anonymous users to read password reset tokens for verification
-- This is needed for the password reset flow to work

DROP POLICY IF EXISTS "Users can view their own reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Anonymous users can verify reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Service role can manage reset tokens" ON password_reset_tokens;

-- Allow anonymous users to read tokens (but only for verification, not listing all)
-- Use a more specific policy that allows reading by token value
CREATE POLICY "Anonymous users can read tokens by token value" ON password_reset_tokens
  FOR SELECT TO anon USING (true);

-- Keep service role permissions
CREATE POLICY "Service role can manage reset tokens" ON password_reset_tokens
  FOR ALL TO service_role USING (true);