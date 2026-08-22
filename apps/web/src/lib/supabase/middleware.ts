import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { stripBOM } from './utils'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    type ResponseCookieOptions = Parameters<(typeof supabaseResponse.cookies)['set']>[2]

    // Strip BOM from the env vars passed to the Supabase SDK. The SDK
    // forwards these into HTTP headers / the API base URL, and undici
    // throws on any value containing U+FEFF. Idempotent.
    const supabaseUrl = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    const supabaseAnonKey = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll().map(({ name, value }) => ({
                        name,
                        // Strip UTF-8 BOM (U+FEFF) prefix from cookies. Old sessions
                        // stored before the server.ts BOM fix may have it baked in;
                        // without stripping, passing the cookie value to
                        // fetch/Headers downstream triggers undici's
                        // "Cannot convert argument to a ByteString" error and
                        // supabase.auth.getUser() returns authError on /api/auth/sync.
                        value: stripBOM(value),
                    }))
                },
                setAll(cookiesToSet: { name: string; value: string; options: ResponseCookieOptions }[]) {
                    // Strip the BOM in BOTH directions: request.cookies.set
                    // (so the in-request cookie store is clean) and
                    // supabaseResponse.cookies.set (so the Set-Cookie header
                    // sent back to the client is clean — otherwise the BOM is
                    // re-persisted on every request cycle and the strip on
                    // getAll() never gets a chance to break the loop).
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, stripBOM(value))
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, stripBOM(value), options)
                    )
                },
            },
        }
    )

    // refreshing the auth token
    const { data: { user } } = await supabase.auth.getUser();

    // Protect TRW (non-academic) routes
    const pathname = request.nextUrl.pathname
    const localeMatch = pathname.match(/^\/(ar|en)(\/|$)/)
    const localePrefix = localeMatch ? `/${localeMatch[1]}` : ''
    const pathWithoutLocale = localePrefix ? pathname.slice(localePrefix.length) || '/' : pathname

    // 1. Protect TRW (non-academic) routes
    if (pathWithoutLocale.startsWith('/non-academic')) {
        if (!user) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }

        // Check for show_extra_assets in app_metadata first (faster)
        const hasExtraAssets = user.app_metadata?.show_extra_assets;

        if (!hasExtraAssets) {
            // Fallback for transition period: check database if not in metadata
            const { data: profile } = await supabase
                .from('profiles')
                .select('show_extra_assets')
                .eq('id', user.id)
                .single();

            if (!profile?.show_extra_assets) {
                return NextResponse.redirect(new URL(`${localePrefix}/`, request.url));
            }
        }
    }

    // 2. Protect Admin routes
    if (pathWithoutLocale.startsWith('/admin') || pathWithoutLocale.startsWith('/admin-dashboard')) {
        if (!user) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }

        const role = user.app_metadata?.role;
        const isAdmin = role === 'admin' || role === 'doctor' || role === 'student_admin';

        if (!isAdmin) {
            // Fallback for transition period: check admins table
            const { data: admin } = await supabase
                .from('admins')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!admin) {
                return NextResponse.redirect(new URL(`${localePrefix}/`, request.url));
            }
        }
    }

    // 3. Protect Profile and Protected User routes
    const protectedUserRoutes = ['/profile', '/quiz-attempts', '/add-summary', '/add-video', '/add-file'];
    if (protectedUserRoutes.some(route => pathWithoutLocale.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }
    }

    return supabaseResponse
}
