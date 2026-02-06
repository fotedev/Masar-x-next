-- Create system_logs table for client-side and server-side logging
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  message text NOT NULL,
  status_code integer,
  request_id text,
  endpoint text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
DROP POLICY IF EXISTS "Authenticated can insert logs" ON system_logs;
CREATE POLICY "Authenticated can insert logs"
ON system_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow only admins to select logs
DROP POLICY IF EXISTS "Admins can view logs" ON system_logs;
CREATE POLICY "Admins can view logs"
ON system_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access" ON system_logs;
CREATE POLICY "Service role full access"
ON system_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
