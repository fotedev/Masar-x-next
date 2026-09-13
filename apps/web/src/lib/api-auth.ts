/**
 * Shared API-route guards (spec 004 AI routes).
 *
 * The two AI endpoints previously hand-rolled identical auth and
 * rate-limit responses with drifting payload shapes. These helpers own
 * that contract in one place: same 401 body, same 429 body + Retry-After
 * header, and a uniform 400 shape for zod-validated request bodies.
 */

import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type ApiAuthResult = { user: User } | { response: NextResponse };

/**
 * T021: Authenticate the caller via getUser() (JWT verification).
 * Returns `{ user }` on success or `{ response }` carrying a ready-to-
 * return 401. Discriminate with `'user' in result`.
 */
export async function requireAuthenticatedUser(): Promise<ApiAuthResult> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication required' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/** T022: uniform 429 (10 req/min per user) with a Retry-After header.
 *  retryAfter is always set on the denial path; the 60s fallback matches
 *  the per-minute window for defensive parity with the optional type. */
export function tooManyRequestsResponse(retryAfter: number | undefined): NextResponse {
  const waitSeconds = retryAfter ?? 60;
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${waitSeconds} seconds.`,
      retryAfter: waitSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(waitSeconds),
      },
    }
  );
}

/** Uniform 400 for zod-validated request bodies. */
export function invalidRequestBody(message: string): NextResponse {
  return NextResponse.json(
    { error: 'Invalid request body', message },
    { status: 400 }
  );
}
