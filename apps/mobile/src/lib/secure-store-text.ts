/**
 * Chunked text storage on top of expo-secure-store.
 *
 * expo-secure-store persists values in the iOS Keychain and Android
 * EncryptedSharedPreferences, but a single stored value is limited to
 * ~2048 bytes (iOS Keychain item limit). Supabase auth session JSON
 * (access JWT + refresh token + user metadata) regularly exceeds that,
 * so this helper splits values into fixed-size chunks:
 *
 *   masarx_auth_<key>          -> {"v":1,"chunks":N}   (header)
 *   masarx_auth_<key>__<0..N-1> -> string chunk
 *
 * All keys share the "masarx_auth_" prefix so security tooling (and a
 * future "clear this device" action) can identify app auth entries.
 *
 * Used by BOTH the Supabase storage adapter (src/lib/supabase.ts) and
 * the app-level LocalAuthSession mirror (src/auth-storage.ts).
 */
import * as SecureStore from "expo-secure-store";

export const SECURE_STORE_KEY_PREFIX = "masarx_auth_";

/** Stay well below the 2048-byte per-value Keychain limit. */
const CHUNK_SIZE = 1600;

/** iOS: item available while the device is unlocked, never migrated to new devices. */
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

function fullKey(key: string): string {
  return `${SECURE_STORE_KEY_PREFIX}${key}`;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [""];
}

export async function secureStoreSetText(key: string, value: string): Promise<void> {
  const chunks = splitIntoChunks(value);
  const previousHeader = await SecureStore.getItemAsync(fullKey(key), SECURE_STORE_OPTIONS);
  let previousChunkCount = 0;
  if (previousHeader) {
    try {
      previousChunkCount = (JSON.parse(previousHeader) as { chunks?: number }).chunks ?? 0;
    } catch {
      previousChunkCount = 0;
    }
  }

  await SecureStore.setItemAsync(
    fullKey(key),
    JSON.stringify({ v: 1, chunks: chunks.length }),
    SECURE_STORE_OPTIONS,
  );
  for (let i = 0; i < chunks.length; i += 1) {
    await SecureStore.setItemAsync(`${fullKey(key)}__${i}`, chunks[i], SECURE_STORE_OPTIONS);
  }
  // Clean up stale chunks if a previous, larger value left extras behind.
  for (let i = chunks.length; i < previousChunkCount; i += 1) {
    await SecureStore.deleteItemAsync(`${fullKey(key)}__${i}`, SECURE_STORE_OPTIONS);
  }
}

export async function secureStoreGetText(key: string): Promise<string | null> {
  const header = await SecureStore.getItemAsync(fullKey(key), SECURE_STORE_OPTIONS);
  if (!header) return null;

  let chunkCount = 0;
  try {
    chunkCount = (JSON.parse(header) as { chunks?: number }).chunks ?? 0;
  } catch {
    // Corrupt header - treat as missing so callers fall back to re-auth.
    return null;
  }
  if (chunkCount <= 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    const part = await SecureStore.getItemAsync(`${fullKey(key)}__${i}`, SECURE_STORE_OPTIONS);
    if (part === null) return null; // Partial write - treat as missing.
    parts.push(part);
  }
  return parts.join("");
}

export async function secureStoreRemoveText(key: string): Promise<void> {
  const header = await SecureStore.getItemAsync(fullKey(key), SECURE_STORE_OPTIONS);
  let chunkCount = 0;
  if (header) {
    try {
      chunkCount = (JSON.parse(header) as { chunks?: number }).chunks ?? 0;
    } catch {
      chunkCount = 0;
    }
  }
  for (let i = 0; i < chunkCount; i += 1) {
    await SecureStore.deleteItemAsync(`${fullKey(key)}__${i}`, SECURE_STORE_OPTIONS);
  }
  await SecureStore.deleteItemAsync(fullKey(key), SECURE_STORE_OPTIONS);
}