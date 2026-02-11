-- Create platform_settings table for app-wide configuration (e.g. active semester)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can modify platform settings"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Seed the default active_semester
INSERT INTO public.platform_settings (key, value)
VALUES ('active_semester', '{"semester": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS 'App-wide key/value settings (e.g. active semester)';
