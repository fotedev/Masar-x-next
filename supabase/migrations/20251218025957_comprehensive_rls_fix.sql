-- 1. Drop all existing policies to ensure a clean slate
DROP POLICY IF EXISTS "select_chat_participants" ON chat_participants;
DROP POLICY IF EXISTS "select_chats" ON chats;
DROP POLICY IF EXISTS "select_messages" ON messages;
DROP POLICY IF EXISTS "select_ai_summaries" ON ai_summaries;
DROP POLICY IF EXISTS "Authenticated users can manage their chat participation" ON public.chat_participants; -- from previous attempt
DROP POLICY IF EXISTS "Enable read access for users who are chat participants" ON public.chats; -- from previous attempt
DROP POLICY IF EXISTS "Allow all operations on chat_participants for authenticated users" ON public.chat_participants; -- from earlier attempt

-- Add more DROP POLICY statements here if there are other policy names on these tables.
-- For example, you might have INSERT, UPDATE, DELETE policies. We'll start with SELECT for now.

-- 2. Enable RLS (if not already enabled) - idempotent
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- 3. Create the correct RLS policies
-- Policy for chat_participants: must be simple, direct to auth.uid()
CREATE POLICY "chat_participants_select_own"
ON chat_participants
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Policy for chats: checks if the user is a participant
CREATE POLICY "chats_select_for_member"
ON chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
  )
);

-- Policy for messages: checks if the user is a participant of the chat the message belongs to
CREATE POLICY "messages_select_for_member"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);

-- Policy for ai_summaries: checks if the user is a participant of the chat the summary belongs to
CREATE POLICY "ai_summaries_select_for_member"
ON ai_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE chat_participants.chat_id = ai_summaries.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);
