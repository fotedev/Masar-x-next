DROP POLICY IF EXISTS "Authenticated users can manage their chat participation" ON public.chat_participants;

CREATE POLICY "Allow authenticated users to manage their own chat participation"
ON public.chat_participants FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
