-- Database Best Practices Migration
-- 1. Automated updated_at column management
-- 2. Automatic RLS enablement for new tables
-- 3. Expanded Audit Logging for core tables

-- ==========================================
-- 1. Automated updated_at management
-- ==========================================

-- Generic function for updating the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper to apply the trigger to a table
DO $$
DECLARE
    t text;
    tables_to_update text[] := ARRAY[
        'courses', 'enrollments', 'profiles', 'reviews', 'quiz_attempts', 
        'course_files', 'course_summaries', 'course_videos', 'rate_limits', 
        'news', 'notifications', 'summaries'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_update LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Drop existing trigger if it exists
            EXECUTE format('DROP TRIGGER IF EXISTS tr_update_%I_updated_at ON public.%I', t, t);
            -- Create the trigger
            EXECUTE format('CREATE TRIGGER tr_update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
        END IF;
    END LOOP;
END $$;


-- ==========================================
-- 2. Automatic RLS for new tables
-- ==========================================

-- Function to enable RLS on any new table
CREATE OR REPLACE FUNCTION public.enable_rls_on_new_table()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' LOOP
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
    END LOOP;
END;
$$;

-- The event trigger itself
-- NOTE: Event triggers might have restrictions on some managed platforms, 
-- but this is the standard SQL approach.
DROP EVENT TRIGGER IF EXISTS tr_auto_enable_rls;
CREATE EVENT TRIGGER tr_auto_enable_rls ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE')
    EXECUTE FUNCTION public.enable_rls_on_new_table();


-- ==========================================
-- 3. Expanded Audit Logging
-- ==========================================

-- Universal Audit Function (Improved version of the existing one)
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
    operation_type text;
    user_id uuid;
BEGIN
    operation_type := TG_OP;
    user_id := auth.uid();

    -- In some contexts (like triggers on auth.users), auth.uid() might be null
    -- We proceed only if we have a user context or if it's a critical system change
    
    INSERT INTO public.audit_logs (
        operation_name,
        user_id,
        changed_data
    ) VALUES (
        TG_TABLE_NAME || '_' || operation_type,
        user_id,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'old_data', CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            'new_data', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
            'timestamp', NOW()
        )
    );

    RETURN NEW;
END;
$$;

-- Apply audit triggers to core tables
DO $$
DECLARE
    t text;
    tables_to_audit text[] := ARRAY['courses', 'profiles', 'admins'];
BEGIN
    FOREACH t IN ARRAY tables_to_audit LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I_changes ON public.%I', t, t);
            -- We typically audit UPDATE and DELETE for bulk tables
            EXECUTE format('CREATE TRIGGER tr_audit_%I_changes AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes()', t, t);
        END IF;
    END LOOP;
END $$;


-- ==========================================
-- 4. Standard Performance Indexes
-- ==========================================
-- Ensure foreign keys are indexed across core tables

DO $$
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_username') THEN
        CREATE INDEX idx_profiles_username ON profiles(username);
    END IF;

    -- reviews
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reviews_course_id') THEN
            CREATE INDEX idx_reviews_course_id ON reviews(course_id) WHERE course_id IS NOT NULL;
        END IF;
    END IF;
END $$;
