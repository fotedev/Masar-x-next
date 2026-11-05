import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { stripBOM } from './utils'

export async function createClient() {
    const cookieStore = await cookies()

    // Strip BOM from the env vars passed to the Supabase SDK. The SDK
    // forwards these into HTTP headers / the API base URL, and undici
    // throws on any value containing U+FEFF. Idempotent — no-op when
    // the env vars are already clean.
    const supabaseUrl = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    const supabaseAnonKey = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')

    type CookieSetOptions = Parameters<typeof cookieStore.set>[2]

    return createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll().map(({ name, value }) => ({
                        name,
                        value: stripBOM(value),
                    }))
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieSetOptions }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, stripBOM(value), options)
                        })
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

/**
 * Spec 033 Track C (audit MID-2): per-request dedupe for the auth
 * roundtrip. Nested layouts ([locale]/layout.tsx + admin-dashboard/
 * layout.tsx) each called getUser() on their own client — two identical
 * /auth/v1 requests per authenticated render. React's cache() scopes the
 * memo to one render pass, so both layouts share a single network call.
 * (The proxy's getUser is a separate runtime and cannot share this.)
 */
export const getCachedUser = cache(async () => {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
})
