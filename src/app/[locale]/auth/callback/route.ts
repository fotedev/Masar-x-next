import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = (() => {
    const raw = searchParams.get('next') ?? '/'
    if (typeof raw !== 'string') return '/'
    if (!raw.startsWith('/')) return '/'
    if (raw.startsWith('//')) return '/'
    if (raw.includes('://')) return '/'
    if (raw.toLowerCase().startsWith('/\\')) return '/'
    return raw
  })()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
