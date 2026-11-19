/**
 * Canonical site URL for this deployment — spec 052.
 *
 * Every faculty instance is a separate Vercel project of the same repo
 * with its own NEXT_PUBLIC_SITE_URL, so sitemap/robots/metadataBase must
 * never hardcode the core domain. Core deployments that don't set the
 * env var keep the historical default. Trailing slashes are stripped so
 * consumers can append slash-prefixed paths ("${SITE_URL}/sitemap.xml")
 * without producing double slashes on owner-typed values (CodeRabbit
 * spec-052 review, Minor).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://masarx.vercel.app"
).replace(/\/+$/, "");
