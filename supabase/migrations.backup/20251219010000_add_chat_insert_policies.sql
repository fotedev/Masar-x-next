-- Add INSERT policies for chats and messages
-- This fixes the 403 Forbidden error when creating chats

-- Enable INSERT policy for chats (users can create chats)
CREATE POLICY "chats_insert_for_authenticated"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

-- Enable INSERT policy for chat_participants (users can add themselves to chats)
CREATE POLICY "cp_insert_authenticated"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Enable INSERT policy for messages (users can send messages in chats they're part of)
CREATE POLICY "messages_insert_for_member"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_participants.chat_id = messages.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);

-- Enable INSERT policy for AI summaries (system can create summaries for chats)
CREATE POLICY "ai_summaries_insert_for_member"
ON public.ai_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_participants.chat_id = ai_summaries.chat_id
      AND chat_participants.user_id = auth.uid()
  )
);

-- Also enable UPDATE and DELETE policies for chats and participants
CREATE POLICY "chats_update_for_creator"
ON public.chats
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chats_delete_for_creator"
ON public.chats
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "cp_update_own"
ON public.chat_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "cp_delete_own"
ON public.chat_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
