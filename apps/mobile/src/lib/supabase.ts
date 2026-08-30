import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// Supabase auth tokens can exceed SecureStore's ~2048-byte-per-key limit.
// This adapter chunks values across multiple secure keys — everything is
// still stored in the Android Keystore-backed encrypted storage, just split.
// 500 chars per chunk keeps every write ≤2048 bytes even at 4 B/char
// (Arabic text / emoji in user_metadata).
const CHUNK_SIZE = 500;

const ChunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const first = await SecureStore.getItemAsync(key);
    if (first === null) return null;
    // A single-chunk value is stored as-is; multi-chunk values carry a
    // "chunks:N" marker so old data stays readable across upgrades.
    if (!first.startsWith("chunks:")) return first;
    const count = Number(first.slice("chunks:".length));
    if (!Number.isFinite(count) || count < 1) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      // Clean up any previous chunks before writing the single value.
      const old = await SecureStore.getItemAsync(key);
      if (old?.startsWith("chunks:")) {
        const count = Number(old.slice("chunks:".length));
        if (Number.isFinite(count) && count > 0) {
          await Promise.all(
            Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
          );
        }
      }
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)),
      ),
    );
    // The marker is the commit point: written last, after all parts.
    await SecureStore.setItemAsync(key, `chunks:${chunks}`);
  },
  removeItem: async (key: string): Promise<void> => {
    const existing = await SecureStore.getItemAsync(key);
    if (existing?.startsWith("chunks:")) {
      const count = Number(existing.slice("chunks:".length));
      if (Number.isFinite(count) && count > 0) {
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
        );
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const SITE_URL = "https://masarx.vercel.app";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast at startup instead of white-screening on a broken client.
  // Values are provided at build time from repo secrets (EXPO_PUBLIC_*).
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
