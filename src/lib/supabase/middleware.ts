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
                    return request.cookies.getAll()
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
    await supabase.auth.getUser();

    // Protect TRW (non-academic) routes
    const pathname = request.nextUrl.pathname
    const localeMatch = pathname.match(/^\/(ar|en)(\/|$)/)
    const localePrefix = localeMatch ? `/${localeMatch[1]}` : ''
    const pathWithoutLocale = localePrefix ? pathname.slice(localePrefix.length) || '/' : pathname

    // 1. Protect TRW (non-academic) routes
    if (pathWithoutLocale.startsWith('/non-academic')) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session, redirect to login
        if (!session) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }

        // Check if user has show_extra_assets flag in profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('show_extra_assets')
            .eq('id', session.user.id)
            .single();

        if (!profile?.show_extra_assets) {
            // If not authorized, redirect to home
            return NextResponse.redirect(new URL(`${localePrefix}/`, request.url));
        }
    }

    // 2. Protect Admin routes
    if (pathWithoutLocale.startsWith('/admin') || pathWithoutLocale.startsWith('/admin-dashboard')) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }

        const { data: admin } = await supabase
            .from('admins')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (!admin) {
            return NextResponse.redirect(new URL(`${localePrefix}/`, request.url));
        }
    }

    // 3. Protect Profile and Protected User routes
    const protectedUserRoutes = ['/profile', '/quiz-attempts', '/add-summary', '/add-video', '/add-file'];
    if (protectedUserRoutes.some(route => pathWithoutLocale.startsWith(route))) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
        }
    }

    return supabaseResponse
}
