/**
 * LocalAuthSession (mobile) - apps/mobile mirror of the desktop's
 * encrypted session file, per
 * specs/004-multi-platform-expansion/data-model.md:
 *
 *   "LocalAuthSession ... Mobile: expo-secure-store (Keychain on iOS,
 *    EncryptedSharedPreferences on Android).
 *    Key attributes: access_token, refresh_token, expires_at, user_id."
 *
 * The Supabase client persists its own (opaque) session through the
 * SecureStoreAdapter in src/lib/supabase.ts; this module keeps a small,
 * versioned, human-inspectable envelope alongside it so app code can
 * answer "is there a stored session for this device?" without reaching
 * into supabase-js internals. Cleared on sign-out (spec FR-004 parity).
 */
import type { SupabaseClient } from "masarx-shared/supabase";

import {
  secureStoreGetText,
  secureStoreRemoveText,
  secureStoreSetText,
} from "./lib/secure-store-text";

const LOCAL_AUTH_SESSION_KEY = "local_auth_session";
export const LOCAL_AUTH_SESSION_VERSION = 1 as const;

type ClientSession = NonNullable<
  Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>["data"]["session"]
>;

export interface LocalAuthSessionEnvelope {
  version: typeof LOCAL_AUTH_SESSION_VERSION;
  savedAt: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number | null;
    user_id: string;
  };
}

export async function saveLocalAuthSession(session: ClientSession): Promise<void> {
  const envelope: LocalAuthSessionEnvelope = {
    version: LOCAL_AUTH_SESSION_VERSION,
    savedAt: new Date().toISOString(),
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      user_id: session.user?.id ?? "",
    },
  };
  await secureStoreSetText(LOCAL_AUTH_SESSION_KEY, JSON.stringify(envelope));
}

export async function getLocalAuthSession(): Promise<LocalAuthSessionEnvelope | null> {
  const raw = await secureStoreGetText(LOCAL_AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalAuthSessionEnvelope;
    if (parsed.version !== LOCAL_AUTH_SESSION_VERSION || !parsed.session?.access_token) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLocalAuthSession(): Promise<void> {
  await secureStoreRemoveText(LOCAL_AUTH_SESSION_KEY);
}