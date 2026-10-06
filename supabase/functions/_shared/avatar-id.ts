/**
 * Avatar public_id derivation + ownership checks (P0 hotfix for delete-avatar).
 *
 * The delete-avatar function must NEVER take the Cloudinary public_id from the
 * request body. It derives the id from the caller's own profile record
 * (`profiles.avatar_url`, written by upload-avatar) and verifies the id lies
 * in the caller's own namespace (`avatars/<user.id>_<timestamp>`).
 *
 * Pure functions only (no Deno / network imports) so they run under `deno test`
 * with zero dependencies.
 */

export const AVATAR_FOLDER = "avatars";
const CLOUDINARY_HOST = "res.cloudinary.com";
const MAX_PUBLIC_ID_LENGTH = 256;

/**
 * Extract the Cloudinary public_id from a secure delivery URL previously
 * stored by upload-avatar, e.g.
 *   https://res.cloudinary.com/<cloud>/image/upload/v1712345678/avatars/<uid>_1712345678.jpg
 *   https://res.cloudinary.com/<cloud>/image/upload/c_fill,w_200/v1712345678/avatars/<uid>_1712345678.png?foo=bar
 *   -> "avatars/<uid>_1712345678"
 * The `avatars` folder segment is located anywhere after `/upload/` so
 * version (`v123/`) and transformation (`c_fill,.../`) prefixes are skipped.
 * Query strings never reach here (URL.pathname only). Returns null for
 * anything that is not exactly this shape. The ownership check in
 * isOwnedAvatarPublicId pins the result to the caller's namespace, so a
 * loose segment search cannot escalate: at most it yields a 403/404, never a
 * foreign id that passes the check.
 */
export function extractCloudinaryPublicId(secureUrl: string): string | null {
  if (typeof secureUrl !== "string" || secureUrl.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(secureUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.hostname.toLowerCase() !== CLOUDINARY_HOST) return null;

  const marker = "/upload/";
  const idx = parsed.pathname.indexOf(marker);
  if (idx < 0) return null;
  const segments = parsed.pathname.slice(idx + marker.length).split("/").filter((s) => s !== "");
  // Locate the avatars folder segment (skips version + transformation prefixes).
  const folderIdx = segments.indexOf(AVATAR_FOLDER);
  if (folderIdx < 0 || folderIdx !== segments.length - 2) return null;
  const leafWithExt = segments[folderIdx + 1];
  // Strip the file extension (delivery format suffix).
  const dot = leafWithExt.lastIndexOf(".");
  if (dot <= 0) return null;
  const publicId = `${AVATAR_FOLDER}/${leafWithExt.slice(0, dot)}`;
  if (publicId.length > MAX_PUBLIC_ID_LENGTH) return null;
  return publicId;
}

/**
 * True only when `publicId` is inside the avatar namespace owned by `userId`:
 *   avatars/<userId>_<anything-sane>
 * Rejects path traversal, separators, control chars and overlong ids.
 */
export function isOwnedAvatarPublicId(
  publicId: string,
  userId: string,
  folder: string = AVATAR_FOLDER,
): boolean {
  if (typeof publicId !== "string" || typeof userId !== "string") return false;
  if (userId.length === 0 || userId.length > 128) return false;
  if (publicId.length === 0 || publicId.length > MAX_PUBLIC_ID_LENGTH) return false;
  if (typeof folder !== "string" || folder.length === 0 || folder.length > 64) return false;
  // Exactly one separator: "<folder>/<leaf>". Anything else (nested paths,
  // traversal attempts, empty segments) is rejected.
  const parts = publicId.split("/");
  if (parts.length !== 2) return false;
  const [folderPart, leaf] = parts;
  if (folderPart !== folder) return false;
  if (leaf.length === 0 || leaf.length > 200) return false;
  if (leaf.includes("..") || leaf.includes("\\")) return false;
  if (/\s/.test(leaf)) return false;
  for (const ch of leaf) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false;
  }
  // userId itself must be a plain token (UUIDs in practice): no separators.
  if (userId.includes("/") || userId.includes("\\")) return false;
  const prefix = `${userId}_`;
  if (!leaf.startsWith(prefix)) return false;
  // Something must follow the "<uid>_" prefix (the timestamp part).
  return leaf.length > prefix.length;
}
