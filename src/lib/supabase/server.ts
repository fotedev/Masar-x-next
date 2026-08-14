import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    type CookieSetOptions = Parameters<typeof cookieStore.set>[2]

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieSetOptions }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            // Strip leading UTF-8 BOM (U+FEFF) and other
                            // non-ASCII characters. undici's Headers.set throws
                            // "Cannot convert argument to a ByteString" if a
                            // cookie value contains anything > 0xFF, and the
                            // supabase ssr client has been observed emitting a
                            // 0xFEFF prefix in some Next.js 16 / @supabase/ssr
                            // 0.8.0 combinations.
                            const cleanValue = value.replace(/^\uFEFF/, '');
                            cookieStore.set(name, cleanValue, options);
                        });
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
