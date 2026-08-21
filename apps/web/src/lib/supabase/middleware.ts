import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    type ResponseCookieOptions = Parameters<(typeof supabaseResponse.cookies)['set']>[2]

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
                        // Mirrors the fix in lib/supabase/server.ts:14-23.
                        value: value.replace(/^\uFEFF/, ''),
                    }))
                },
                setAll(cookiesToSet: { name: string; value: string; options: ResponseCookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
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
