/**
 * AI chat local history (spec 019 C5/T091) — AsyncStorage persistence
 * so conversations survive an app restart (web guest parity, local
 * only; DB sync to ai_chat_messages is a later spec).
 *
 * Storage isolation: the key is deliberately OUTSIDE the
 * `masarx_read_cache_` prefix — chat history must not expire (no TTL
 * envelope) and must survive `cacheClearAll` (which wipes every
 * read-cache key).
 *
 * Write policy lives in the screen (spec 019 lesson 2026-09-16 #14):
 * persistence is EVENT-driven — the screen raises a pendingPersist flag
 * only on real send/finalize/failure events and deletion happens
 * exclusively in clearChat. Nothing here writes implicitly.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Outside the read-cache prefix on purpose — see the header note. */
export const CHAT_HISTORY_KEY = "masarx_ai_chat_cs_assistant";

/** Web parity: guest history is capped at 100 messages, oldest dropped. */
export const CHAT_HISTORY_CAP = 100;

export interface PersistedChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  /** Original user text, kept so the retry affordance survives a restart. */
  retryText?: string;
}

interface ScreenChatMessage extends PersistedChatMessage {
  /** Transient spinner bubble — never persisted. */
  pending?: boolean;
}

function isPersistedMessage(value: unknown): value is PersistedChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.text === "string" &&
    (m.failed === undefined || typeof m.failed === "boolean") &&
    (m.retryText === undefined || typeof m.retryText === "string")
  );
}

/**
 * Project screen messages to the persisted shape: transient `pending`
 * spinner bubbles are excluded and the array is capped at
 * CHAT_HISTORY_CAP, dropping the oldest.
 */
export function toPersisted(messages: ScreenChatMessage[]): PersistedChatMessage[] {
  return messages
    .filter((m) => !m.pending)
    .slice(-CHAT_HISTORY_CAP)
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      ...(m.failed ? { failed: true } : {}),
      ...(m.retryText !== undefined ? { retryText: m.retryText } : {}),
    }));
}

/**
 * Load the persisted history. Any malformed content (corrupt JSON,
 * non-array, wrong shapes) degrades to an empty history — a broken
 * store must never crash the chat.
 */
export async function loadChatHistory(): Promise<PersistedChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistedMessage).slice(-CHAT_HISTORY_CAP);
  } catch {
    return [];
  }
}

/** Best-effort write; a storage failure must never break the chat UI. */
export async function saveChatHistory(messages: ScreenChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toPersisted(messages)));
  } catch {
    // Best-effort by design.
  }
}

/** Deletion is exclusive to the chat's clear action (spec 019 C5). */
export async function clearChatHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
  } catch {
    // Best-effort by design.
  }
}
