-- Fix Audit Trigger: Handle NULL auth.uid() during signup
-- 
-- Problem: When a new user signs up, the handle_new_user() trigger creates a 
-- profile row. The audit_table_changes() trigger then fires but auth.uid() is 
-- NULL causing an insert violation on audit_logs.user_id (NOT NULL constraint).
--
-- Solution: Skip audit logging when there is no user context (auth.uid() IS NULL)

-- First, make audit_logs.user_id nullable to allow system-level changes
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Update the audit function to gracefully handle NULL user contexts
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
    operation_type text;
    current_user_id uuid;
BEGIN
    operation_type := TG_OP;
    current_user_id := auth.uid();

    -- Only audit if we have a user context, or if it's a system-level change
    -- we want to track (user_id will be NULL for system changes)
    
    INSERT INTO public.audit_logs (
        operation_name,
        user_id,
        changed_data
    ) VALUES (
        TG_TABLE_NAME || '_' || operation_type,
        current_user_id, -- This can now be NULL for system-level changes
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'old_data', CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            'new_data', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
            'timestamp', NOW(),
            'triggered_by_system', current_user_id IS NULL
        )
    );

    RETURN NEW;
END;
$$;

-- Add a comment explaining the behavior
COMMENT ON FUNCTION public.audit_table_changes() IS 
'Audit trigger function that logs table changes. user_id may be NULL for system-triggered changes (e.g., during user signup when auth.uid() is not available).';
