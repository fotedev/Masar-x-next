-- spec 049: zane server-backed chat history — conversations + message linkage
-- Additive-only: new conversations table (owner-only RLS, audit + updated_at per
-- the spec-037 pattern) and a nullable conversation_id FK on ai_chat_messages
-- (spec-038 anchoring pattern). Baseline functions reused (set_updated_at,
-- audit_table_changes); one new helper touch_conversation_updated_at().
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP TRIGGER/POLICY IF EXISTS,
-- DO-block constraint guard, backfill guarded by conversation_id IS NULL.
-- Applied out-of-band to prod via MCP apply_migration (ledger version
-- 20261114132141, name zane_conversations); this repo file is named 1:1 to
-- keep the migration chains aligned (seeds pattern).
-- Followed by 20261114132536_zane_conversations_ownership_fk.sql, which
-- replaces the single-column FK below with a composite ownership FK.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('cs_assistant','student_agent','group_rag')),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_conversations_user_mode_updated
  ON public.conversations (user_id, mode, updated_at DESC);

-- updated_at trigger (baseline set_updated_at, spec-037 pattern)
DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit trigger (baseline audit_table_changes, spec-037 pattern)
DROP TRIGGER IF EXISTS tr_audit_conversations_changes ON public.conversations;
CREATE TRIGGER tr_audit_conversations_changes
  AFTER UPDATE OR DELETE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- users (not just admins) now fire the audit trigger on their own
-- conversation updates/deletes; the baseline grant covered only admin/MCP
-- roles. Trigger functions cannot be invoked directly, so the grant is safe.
GRANT EXECUTE ON FUNCTION public.audit_table_changes() TO authenticated, service_role;

-- owner-only RLS
DROP POLICY IF EXISTS conversations_select_own ON public.conversations;
CREATE POLICY conversations_select_own ON public.conversations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS conversations_insert_own ON public.conversations;
CREATE POLICY conversations_insert_own ON public.conversations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS conversations_update_own ON public.conversations;
CREATE POLICY conversations_update_own ON public.conversations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS conversations_delete_own ON public.conversations;
CREATE POLICY conversations_delete_own ON public.conversations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- evolve ai_chat_messages: conversation linkage + updated_at
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS conversation_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ai_chat_messages_conversation_id'
      AND conrelid = 'public.ai_chat_messages'::regclass
  ) THEN
    ALTER TABLE public.ai_chat_messages
      ADD CONSTRAINT fk_ai_chat_messages_conversation_id
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_created
  ON public.ai_chat_messages (conversation_id, created_at);

ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_ai_chat_messages_updated_at ON public.ai_chat_messages;
CREATE TRIGGER set_ai_chat_messages_updated_at
  BEFORE UPDATE ON public.ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- touch the parent conversation on message insert (server-authoritative last
-- activity: drives list ordering + current-conversation pick; the inserting
-- user owns the row, so conversations_update_own RLS passes)
CREATE OR REPLACE FUNCTION public.touch_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END
$function$;

GRANT EXECUTE ON FUNCTION public.touch_conversation_updated_at() TO authenticated, service_role;

DROP TRIGGER IF EXISTS tr_touch_conversation_updated_at ON public.ai_chat_messages;
CREATE TRIGGER tr_touch_conversation_updated_at
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW
  WHEN (NEW.conversation_id IS NOT NULL)
  EXECUTE FUNCTION public.touch_conversation_updated_at();

-- backfill: one untitled conversation per existing (user_id, mode) thread;
-- idempotent — the IS NULL predicate makes re-runs no-ops
INSERT INTO public.conversations (user_id, mode)
SELECT DISTINCT user_id, mode
FROM public.ai_chat_messages
WHERE conversation_id IS NULL;

UPDATE public.ai_chat_messages m
SET conversation_id = c.id
FROM public.conversations c
WHERE m.conversation_id IS NULL
  AND c.user_id = m.user_id
  AND c.mode = m.mode;
