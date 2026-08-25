/**
 * GitHub Releases constants for Masar X desktop app.
 *
 * Why a separate public releases repo: the source repo
 * `fotedev/Masar-x-next` is private, so its GitHub Releases are also
 * private (anonymous 404). We push build artifacts to the public
 * `fotedev/masarx-releases` repo so the marketing site and
 * `electron-updater` can fetch them without auth.
 *
 * All URLs use `/releases/latest/download/` so they always point to the
 * most recent stable release — bumping the version only requires tagging
 * a new release, not updating the website.
 */

const RELEASES_REPO = "fotedev/masarx-releases";
const BASE = `https://github.com/${RELEASES_REPO}/releases/latest/download`;

export const DOWNLOAD_URLS = {
  /** NSIS installer — recommended for most users (~121 MB). */
  windowsInstaller: `${BASE}/Masar-X-Setup-x64.exe`,
  /** Portable build — no install, runs from any folder. */
  windowsPortable: `${BASE}/Masar-X-Portable-x64.exe`,
  /** `electron-updater` metadata file. Anonymous fetchable. */
  latestMeta: `${BASE}/latest.yml`,
  /** Human-facing release notes URL. */
  releasesPage: `https://github.com/${RELEASES_REPO}/releases/latest`,
} as const;

export type Platform = "windows" | "macos" | "android" | "other";

/**
 * Best-effort OS detection from the User-Agent header.
 * Used to pick the primary CTA copy on the home page hero.
 *
 * NOTE: This is a hint, not a contract. The `/downloads` page always
 * shows every platform explicitly so users on misidentified UAs can
 * still find their build.
 */
export function detectPlatform(userAgent: string | null | undefined): Platform {
  if (!userAgent) return "other";
  const ua = userAgent;

  // Android has to be checked before "Linux" (Chromium on Android reports Linux too).
  if (/Android/i.test(ua)) return "android";
  // iOS / iPadOS — not shipped yet but routed so the card is correct.
  if (/iPhone|iPad|iPod/i.test(ua)) return "other";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|macOS/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "other";

  return "other";
}
