-- spec 049 review fix-forward (CodeRabbit Major, thread on
-- 20261114132141_zane_conversations.sql): messages inserted without a
-- conversation were invisible after restore. The applied migration's backfill
-- ran exactly once at migration time, so rows written afterwards by a
-- pre-change client bundle (or by the current client when conversation
-- creation fails and the insert still goes out unlinked) landed with
-- conversation_id NULL — the column is nullable, the insert succeeds, no
-- trigger assigns them, and the restore's conversation_id filter never
-- returns them. The rows stayed in the table; the user could not see them.
--
-- Fix: a BEFORE INSERT trigger assigns every orphan row to the caller's most
-- recent conversation for the row's mode, creating one when none exists —
-- the same grouping the one-shot backfill used, now enforced continuously.
-- SECURITY INVOKER on purpose (repo definer-fn hygiene, Q2 audit): the
-- inserting user's own RLS grants make it work — ai_chat_messages INSERT is
-- WITH CHECK (auth.uid() = user_id) so NEW.user_id is always the caller, and
-- conversations_select_own/insert_own let them read and create their own
-- thread. A row crafted with another user's id fails the conversations
-- insert WITH CHECK and the whole statement errors — fail-closed.
-- The tr_touch_conversation_updated_at AFTER INSERT trigger runs after this
-- one, so it sees the assigned conversation_id and bumps updated_at as usual.
--
-- Concurrency note: two simultaneous orphan inserts for a thread with no
-- conversation can each create one (no lock). Both remain owner-correct and
-- visible; dedup is deliberately left to the rare failure path this trigger
-- exists for. Idempotent: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
-- Owner-deploy: applied to prod out-of-band after merge (seeds pattern), like
-- the 20261114132141 baseline it complements.

CREATE OR REPLACE FUNCTION public.assign_orphan_ai_chat_conversation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conv_id uuid;
BEGIN
  SELECT id INTO conv_id
  FROM public.conversations
  WHERE user_id = NEW.user_id AND mode = NEW.mode
  ORDER BY updated_at DESC
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (user_id, mode)
    VALUES (NEW.user_id, NEW.mode)
    RETURNING id INTO conv_id;
  END IF;

  NEW.conversation_id := conv_id;
  RETURN NEW;
END
$function$;

GRANT EXECUTE ON FUNCTION public.assign_orphan_ai_chat_conversation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_ai_chat_messages_assign_conversation ON public.ai_chat_messages;
CREATE TRIGGER trg_ai_chat_messages_assign_conversation
  BEFORE INSERT ON public.ai_chat_messages
  FOR EACH ROW
  WHEN (NEW.conversation_id IS NULL)
  EXECUTE FUNCTION public.assign_orphan_ai_chat_conversation();
