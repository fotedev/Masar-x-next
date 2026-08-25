/**
 * GitHub Releases helpers for Masar X desktop app.
 *
 * Why a separate public releases repo: the source repo
 * `fotedev/Masar-x-next` is private, so its GitHub Releases are also
 * private (anonymous 404). We push build artifacts to the public
 * `fotedev/masarx-releases` repo so the marketing site and
 * `electron-updater` can fetch them without auth.
 *
 * Why dynamic URLs: `electron-builder` defaults to version-suffixed
 * asset names (`Masar-X-Setup-0.5.8-x64.exe`). GitHub's
 * `/releases/latest/download/<name>` is LITERAL — it does not do fuzzy
 * matching. So we cannot hardcode the asset name; we have to ask GitHub
 * which release is "latest" and use the real `browser_download_url`.
 *
 * If the GitHub API call fails, we fall back to fetching `latest.yml`
 * (electron-updater's metadata file) and parsing it as YAML. If THAT
 * also fails, the page shows a clear error instead of broken links.
 */

const RELEASES_REPO = "fotedev/masarx-releases";
const API_LATEST = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
const META_URL = `https://github.com/${RELEASES_REPO}/releases/latest/download/latest.yml`;
const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;

export type Platform = "windows" | "macos" | "android" | "other";

export type ReleaseUrls = {
  version: string;
  windowsInstaller: string;
  windowsPortable: string;
  installerSizeBytes: number;
  portableSizeBytes: number;
  releasesPage: string;
};

/**
 * Best-effort OS detection from the User-Agent header.
 *
 * NOTE: This is a hint, not a contract. The `/downloads` page always
 * shows every platform explicitly so users on misidentified UAs can
 * still find their build.
 */
export function detectPlatform(userAgent: string | null | undefined): Platform {
  if (!userAgent) return "other";
  const ua = userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "other";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|macOS/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "other";
  return "other";
}

/**
 * Fetch the latest release from GitHub and return the actual
 * `browser_download_url` for the Windows installer and portable
 * builds.
 *
 * Caching: `next: { revalidate: 3600 }` lets the Next.js data cache
 * keep the response for 1 hour, so we don't hit the API on every
 * page view. After 1h, the next request triggers a background
 * re-fetch (stale-while-revalidate).
 */
export async function getLatestReleaseUrls(): Promise<ReleaseUrls> {
  // Strategy 1: GitHub REST API. Returns assets with browser_download_url.
  try {
    const res = await fetch(API_LATEST, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const assets: Array<{ name: string; browser_download_url: string; size: number }> =
        data.assets || [];
      const installer = assets.find((a) => /Setup[^/]*\.exe$/i.test(a.name));
      const portable = assets.find((a) => /Portable[^/]*\.exe$/i.test(a.name));

      if (installer && portable) {
        return {
          version: String(data.tag_name || "").replace(/^v/, "") || "latest",
          windowsInstaller: installer.browser_download_url,
          windowsPortable: portable.browser_download_url,
          installerSizeBytes: installer.size,
          portableSizeBytes: portable.size,
          releasesPage: data.html_url || RELEASES_PAGE,
        };
      }
    }
  } catch {
    // fall through to YAML fallback
  }

  // Strategy 2: Parse latest.yml. No API rate limit, raw file download.
  try {
    const res = await fetch(META_URL, { next: { revalidate: 3600 } });
    if (res.ok) {
      const yaml = await res.text();
      const urls = parseLatestYml(yaml);
      if (urls) return { ...urls, releasesPage: RELEASES_PAGE };
    }
  } catch {
    // fall through
  }

  throw new Error(
    "Could not fetch the latest Masar X release. Please visit the releases page directly: " +
      RELEASES_PAGE,
  );
}

/**
 * Minimal hand-rolled YAML parser for electron-builder's `latest.yml`.
 * We only need the top-level `version`, `path` (installer URL), and
 * the `files:` list (to find the portable URL).
 *
 * Avoids adding a `js-yaml` dependency. Strict subset of YAML — fails
 * loud if electron-builder's output format ever changes shape.
 */
function parseLatestYml(yaml: string): Omit<ReleaseUrls, "releasesPage"> | null {
  const lines = yaml.split(/\r?\n/);
  let version = "";
  const files: Array<{ url: string; size: number }> = [];
  let inFiles = false;
  let currentFile: { url: string; size: number } | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, ""); // strip comments
    if (!line.trim()) continue;

    if (/^\s*files:\s*$/.test(line)) {
      inFiles = true;
      currentFile = null;
      continue;
    }
    if (inFiles && !/^\s+-\s/.test(line) && !/^\s+\w/.test(line)) {
      inFiles = false;
      currentFile = null;
    }

    const topMatch = line.match(/^version:\s*['"]?([^'"\s]+)['"]?\s*$/);
    if (topMatch) {
      version = topMatch[1];
      continue;
    }
    const pathMatch = line.match(/^path:\s*['"]?([^'"\s]+)['"]?\s*$/);
    if (pathMatch) {
      // `path:` is the installer's filename — the same value is also
      // present in `files[0].url`, so we don't need to store it.
      continue;
    }
    if (inFiles) {
      const newFileMatch = line.match(/^\s+-\s+url:\s*['"]?([^'"\s]+)['"]?\s*$/);
      if (newFileMatch) {
        if (currentFile) files.push(currentFile);
        currentFile = { url: newFileMatch[1], size: 0 };
        continue;
      }
      const sizeMatch = line.match(/^\s+size:\s*(\d+)\s*$/);
      if (sizeMatch && currentFile) {
        currentFile.size = Number(sizeMatch[1]);
        continue;
      }
    }
  }
  if (currentFile) files.push(currentFile);

  if (!version) return null;
  const base = `${RELEASES_REPO}/releases/latest/download`;

  const installer = files.find((f) => /Setup[^/]*\.exe$/i.test(f.url));
  const portable = files.find((f) => /Portable[^/]*\.exe$/i.test(f.url));
  if (!installer) return null;
  // For the portable, prefer a file in `files:`; fall back to constructing from `path`.
  const portableName = portable?.url || `Masar-X-Portable-${version}-x64.exe`;

  return {
    version,
    windowsInstaller: `https://github.com/${base}/${installer.url}`,
    windowsPortable: `https://github.com/${base}/${portableName}`,
    installerSizeBytes: installer.size,
    portableSizeBytes: portable?.size || 0,
  };
}

/** Format a byte count as a short human label (e.g. "121 MB"). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  // Use MB for anything over 1 MB; one decimal place only when < 10.
  if (units[i] === "MB") return `${value.toFixed(value < 10 ? 1 : 0)} MB`;
  return `${value.toFixed(0)} ${units[i]}`;
}
