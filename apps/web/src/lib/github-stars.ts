/**
 * GitHub repo star count for the footer's "Star on GitHub" badge
 * (spec 054). Same fetch pattern as github-releases.ts: unauthenticated
 * REST + the Next.js data cache (`revalidate: 3600`), so the upstream
 * cost is ~1 call/hour per server instance — not per page view.
 *
 * Two deliberate differences from github-releases:
 * 1. This call sits in global chrome (the [locale] layout renders every
 *    page), so it hard-caps at 2.5s via AbortSignal.timeout instead of
 *    being able to hang the whole render.
 * 2. It never throws: ANY failure (non-OK, malformed body, network
 *    error, abort) degrades to `null`, and the footer then renders a
 *    plain star link without a count (spec FR-2/FR-3) — graceful
 *    degradation instead of the loud releases error.
 */

export const GITHUB_ORG_URL = "https://github.com/Masar-X";
export const GITHUB_REPO_URL = "https://github.com/Masar-X/Masar-x";

const REPO = "Masar-X/Masar-x";
const API_REPO_URL = `https://api.github.com/repos/${REPO}`;

/** Hard cap so a slow/hung GitHub API can never stall global chrome. */
const FETCH_TIMEOUT_MS = 2500;

export async function getRepoStars(): Promise<number | null> {
  try {
    const res = await fetch(API_REPO_URL, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const stars = (data as { stargazers_count?: unknown } | null)
      ?.stargazers_count;
    return typeof stars === "number" && Number.isFinite(stars)
      ? stars
      : null;
  } catch {
    // Rate-limited, offline, aborted, malformed — all degrade to the
    // plain star link. Never loud (unlike the releases fetch).
    return null;
  }
}
