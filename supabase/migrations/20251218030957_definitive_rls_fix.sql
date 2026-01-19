-- 1. Get and drop all existing policies on implicated tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('chat_participants', 'chats', 'messages', 'ai_summaries')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename || ';';
    END LOOP;
END;
$$;


-- 2. Enable RLS (idempotent - no harm in running again)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- 3. Create the correct RLS policies
-- ✅ chat_participants: Simple, direct. No JOINs, no EXISTS.
CREATE POLICY "cp_select_own"
ON public.chat_participants
FOR SELECT
USING (
  user_id = auth.uid()
);

CREATE POLICY "cp_insert_own"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- ✅ chats: Depends on chat_participants via EXISTS (allowed)
CREATE POLICY "chats_select_for_member"
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
  )
);

-- ✅ messages: Depends on chat_participants via EXISTS (allowed)
CREATE POLICY "messages_select_for_member"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);

-- ✅ ai_summaries: Depends on chat_participants via EXISTS (allowed)
CREATE POLICY "ai_summaries_select_for_member"
ON public.ai_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_participants.chat_id = ai_summaries.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);
