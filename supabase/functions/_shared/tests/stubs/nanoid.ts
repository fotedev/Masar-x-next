/**
 * Offline test double for `https://esm.sh/nanoid@3.3.20` (same URL-safe
 * alphabet, backed by the Web Crypto RNG instead of a network module).
 */
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";

export function nanoid(size = 21): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}

export default nanoid;
