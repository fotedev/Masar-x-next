/**
 * Strip the UTF-8 byte-order-mark (U+FEFF) from the start of a string.
 *
 * `@supabase/ssr@0.8.0` has been observed emitting a 0xFEFF prefix on
 * cookie values in some Next.js 16 / undici combinations. The BOM is a
 * non-ASCII character that `undici`'s `Headers.set` rejects with
 *
 *   TypeError: Cannot convert argument to a ByteString because the
 *   character at index 0 has a value of 65279 which is greater than 255.
 *
 * The fix is to strip the BOM at every boundary where a value crosses
 * into undici territory: cookies read from the request, cookies written
 * to the response, and any string passed to `createClient` / `createServerClient`
 * (the Supabase SDK uses the URL and keys in HTTP headers internally).
 *
 * Idempotent: re-stripping an already-clean string is a no-op. Safe to
 * call at every layer.
 */
export function stripBOM(value: string): string {
  // Only the first code point matters — BOM is a zero-width character at
  // position 0. A global strip is unnecessary and would be wrong (a BOM
  // is meaningful inside a string in some encodings).
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
