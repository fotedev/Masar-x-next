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
    if (request.nextUrl.pathname.startsWith('/non-academic')) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 1. If no session, redirect to login
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 2. Check if user has show_extra_assets flag in profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('show_extra_assets')
            .eq('id', session.user.id)
            .single();

        if (!profile?.show_extra_assets) {
            // If not authorized, redirect to home
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return supabaseResponse
}
