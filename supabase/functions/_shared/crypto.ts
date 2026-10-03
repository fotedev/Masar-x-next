/**
 * Crypto helpers for Supabase Edge Functions.
 *
 * Extracted from four inline copies of the byte→hex conversion
 * (request-password-reset, reset-password, delete-avatar, delete-file).
 */

export const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const sha256Hex = async (input: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));

export const sha1Hex = async (input: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input)));
