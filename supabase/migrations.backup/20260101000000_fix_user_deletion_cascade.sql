-- Migration to fix "Database error deleting user" by adding ON DELETE CASCADE to all user-related tables

-- 1. analytics
ALTER TABLE public.analytics 
DROP CONSTRAINT IF EXISTS analytics_user_id_fkey,
ADD CONSTRAINT analytics_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 2. assistant_messages
ALTER TABLE public.assistant_messages 
DROP CONSTRAINT IF EXISTS assistant_messages_user_id_fkey,
ADD CONSTRAINT assistant_messages_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 3. chat_participants
ALTER TABLE public.chat_participants 
DROP CONSTRAINT IF EXISTS chat_participants_user_id_fkey,
ADD CONSTRAINT chat_participants_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 4. messages
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 5. chats
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_created_by_fkey,
ADD CONSTRAINT chats_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 6. news
ALTER TABLE public.news 
DROP CONSTRAINT IF EXISTS news_created_by_fkey,
ADD CONSTRAINT news_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 7. appeals
ALTER TABLE public.appeals 
DROP CONSTRAINT IF EXISTS appeals_created_by_fkey,
ADD CONSTRAINT appeals_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE public.appeals 
DROP CONSTRAINT IF EXISTS appeals_reviewed_by_fkey,
ADD CONSTRAINT appeals_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 8. admins
ALTER TABLE public.admins
DROP CONSTRAINT IF EXISTS admins_user_id_fkey,
ADD CONSTRAINT admins_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 9. exhausted_api_keys
ALTER TABLE public.exhausted_api_keys 
DROP CONSTRAINT IF EXISTS exhausted_api_keys_user_id_fkey,
ADD CONSTRAINT exhausted_api_keys_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 10. Robust Catch-All: Find any other foreign keys referencing auth.users and fix them
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_schema = 'auth'
          AND ccu.table_name = 'users'
          AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.table_schema, r.table_name, r.constraint_name);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE', 
                       r.table_schema, r.table_name, r.constraint_name, r.column_name);
    END LOOP;
END $$;
