-- Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    summary_id uuid REFERENCES public.summaries(id) ON DELETE CASCADE,
    appeal_reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- New column added here
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
