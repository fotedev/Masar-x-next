-- Create table to track exhausted API keys
CREATE TABLE public.exhausted_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  exhausted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate entries for same key per user
  UNIQUE(api_key, user_id)
);

-- Create index for faster queries
CREATE INDEX idx_exhausted_api_keys_user_id ON public.exhausted_api_keys(user_id);
CREATE INDEX idx_exhausted_api_keys_api_key ON public.exhausted_api_keys(api_key);

-- RLS Policy: Users can only see their own exhausted keys
ALTER TABLE public.exhausted_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_exhausted_keys"
ON public.exhausted_api_keys
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_exhausted_keys"
ON public.exhausted_api_keys
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow service role to manage all exhausted keys (for edge functions)
CREATE POLICY "service_role_can_manage_all_exhausted_keys"
ON public.exhausted_api_keys
FOR ALL
TO service_role
USING (true);
