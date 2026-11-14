/**
 * Conversation helpers for server-backed chat history (spec 049). Pure logic
 * — no supabase client, no React — so the title derivation and the
 * current-conversation pick are unit-testable in isolation.
 */
import type { Conversation } from "@/types/database";

/** Longest stored conversation title; longer first messages get an ellipsis. */
export const CONVERSATION_TITLE_MAX = 60;

/**
 * Title for a new conversation: the trimmed first user message collapsed to
 * one line, truncated with an ellipsis. Whitespace-only input yields null —
 * the conversation is created untitled and the list UI (spec 049 follow-up)
 * renders its localized fallback.
 */
export const deriveConversationTitle = (firstUserMessage: string): string | null => {
  const collapsed = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= CONVERSATION_TITLE_MAX) return collapsed;
  return `${collapsed.slice(0, CONVERSATION_TITLE_MAX).trimEnd()}…`;
};

/**
 * The conversation the signed-in chat should restore: the most recently
 * active one (updated_at is bumped server-side on every message insert via
 * tr_touch_conversation_updated_at). Ties break deterministically on id so
 * concurrent equal timestamps can't flip the pick between renders.
 */
export const pickCurrentConversation = (rows: Conversation[]): Conversation | null =>
  rows.reduce<Conversation | null>((best, row) => {
    if (!best) return row;
    if (row.updated_at > best.updated_at) return row;
    if (row.updated_at === best.updated_at && row.id > best.id) return row;
    return best;
  }, null);
