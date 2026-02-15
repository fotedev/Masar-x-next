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
    try {
        await supabase.auth.getUser()
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (message.toLowerCase().includes('invalid refresh token')) {
            try {
                await supabase.auth.signOut()
            } catch {
                // ignore
            }
        } else {
            throw e
        }
    }

    return supabaseResponse
}
