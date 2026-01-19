CREATE POLICY "Enable read access for users who are chat participants"
ON public.chats FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_id = chats.id AND user_id = auth.uid()
  )
);
