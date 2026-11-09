import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Locales supported by the routing config in src/proxy.ts. Keep in sync.
const SUPPORTED_LOCALES = ['ar', 'en'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
const DEFAULT_LOCALE: SupportedLocale = 'ar'

// spec 040: exported for unit tests — behavior unchanged.
export function normalizeLocale(raw: string | undefined): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? '')
    ? (raw as SupportedLocale)
    : DEFAULT_LOCALE
}

// Build a locale-prefixed target path without double-prefixing. The user
// may arrive with `next` that already carries a locale prefix (e.g. the
// middleware redirected to `/ar/login?next=/en/subjects/math`), or with
// an unprefixed path (e.g. `/login` after the auth-gate redirect).
// spec 040: exported for unit tests — behavior unchanged.
export function localizeNext(next: string, locale: SupportedLocale): string {
  if (next === '/') return `/${locale}`
  if (next.startsWith(`/${locale}`)) return next
  const path = next.startsWith('/') ? next : `/${next}`
  return `/${locale}${path}`
}

// spec 040: extracted verbatim from the inline IIFE in GET so the
// open-redirect sanitizer is unit-testable — behavior unchanged.
export function sanitizeNext(raw: string | null): string {
  const next = raw ?? '/'
  if (typeof next !== 'string') return '/'
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  if (next.includes('://')) return '/'
  if (next.toLowerCase().startsWith('/\\')) return '/'
  return next
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = sanitizeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Keep the user in the same locale they started the OAuth flow from;
      // route through [locale] so the next-intl middleware does not bounce
      // them back to root after sign-in (I4 invariant).
      return NextResponse.redirect(`${origin}${localizeNext(next, locale)}`)
    }
  }

  // Error path: stay under the same locale and preserve `next` (when safe)
  // so the login page can retry without losing context.
  const search = new URLSearchParams({ error: 'auth-code-error' })
  if (next !== '/') search.set('next', next)
  return NextResponse.redirect(
    `${origin}/${locale}/login?${search.toString()}`,
  )
}
