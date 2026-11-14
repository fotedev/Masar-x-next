-- spec 049 fix-forward: bind message ownership to conversation ownership.
-- The single-column FK (conversation_id -> conversations.id) let a user
-- insert a message with user_id = self but conversation_id = another user's
-- conversation (messages RLS checks only user_id; the FK never checks the
-- parent owner). Replace it with a composite ownership FK so a message can
-- only ever attach to a conversation it owns:
--   UNIQUE (id, user_id) on conversations
--   FK (conversation_id, user_id) -> conversations (id, user_id) ON DELETE CASCADE
-- Existing rows all satisfy the pair (backfill linked by user_id), so the
-- constraint validates instantly. Idempotent DO-block guards throughout.
-- Applied out-of-band to prod via MCP apply_migration (ledger version
-- 20261114132536, name zane_conversations_ownership_fk); repo file named 1:1.

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_id_user_key UNIQUE (id, user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ai_chat_messages_conversation_id'
      AND conrelid = 'public.ai_chat_messages'::regclass
  ) THEN
    ALTER TABLE public.ai_chat_messages
      DROP CONSTRAINT fk_ai_chat_messages_conversation_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ai_chat_messages_conversation'
      AND conrelid = 'public.ai_chat_messages'::regclass
  ) THEN
    ALTER TABLE public.ai_chat_messages
      ADD CONSTRAINT fk_ai_chat_messages_conversation
      FOREIGN KEY (conversation_id, user_id)
      REFERENCES public.conversations (id, user_id)
      ON DELETE CASCADE;
  END IF;
END $$;
