-- Cleanup Migration: Remove 'Summary' and rename 'content_analytics_old'
-- This addresses inconsistencies between remote state and local codebase

DO $$
BEGIN
    -- 1. Drop the capitalized 'Summary' table/view if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Summary') THEN
        IF (SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Summary') = 'VIEW' THEN
            DROP VIEW public."Summary";
        ELSE
            DROP TABLE public."Summary";
        END IF;
    END IF;

    -- 2. Rename 'content_analytics_old' to 'content_analytics' if the old one exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_analytics_old') THEN
        -- If content_analytics already exists (as table or view), drop it first
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_analytics') THEN
            IF (SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_analytics') = 'VIEW' THEN
                DROP VIEW public.content_analytics;
            ELSE
                DROP TABLE public.content_analytics;
            END IF;
        END IF;
        -- Rename the table
        ALTER TABLE public.content_analytics_old RENAME TO content_analytics;
    END IF;
END $$;
