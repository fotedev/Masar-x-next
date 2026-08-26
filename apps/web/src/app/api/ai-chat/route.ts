import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';

/**
 * Server-side proxy to the Supabase Edge Function `ai-chat`.
 *
 * This route exists because `packages/shared/src/ai/index.ts:39` points
 * the cross-platform AI client at `/api/ai-chat` (a Next.js path, not a
 * Supabase function URL). Without this route, the shared client 404s.
 * Adding the route here resolves the routing mismatch without changing
 * the shared client (preserving the contract surface for desktop and
 * mobile).
 *
 * The route forwards the request to
 * `${SUPABASE_URL}/functions/v1/ai-chat` and returns the response
 * unchanged. The AI provider key NEVER appears in this code path —
 * it lives only in the Edge Function's env vars.
 *
 * Companion to the existing `/api/ai/chat` (Puter.js fallback with a
 * different request/response shape — left untouched, separate feature).
 *
 * Implements Spec 004 task T054 + tasks.md T014/T015 (CI grep + gitleaks
 * for AI provider strings) and the contracts/ai-boundary.md
 * chokepoint contract.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const AI_CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-chat`;

// Forbidden headers — the client should NEVER be sending the AI provider
// key over the wire. The Edge Function also checks these (defense in
// depth); this proxy is the first line of detection.
const FORBIDDEN_HEADERS = [
  'x-ai-provider-key',
  'x-openai-api-key',
  'x-anthropic-api-key',
  'x-gemini-api-key',
];

export async function POST(req: NextRequest) {
  try {
    // 1. Reject forbidden headers
    for (const h of FORBIDDEN_HEADERS) {
      if (req.headers.get(h)) {
        return NextResponse.json(
          { error: 'Forbidden: provider key header not allowed' },
          { status: 403 }
        );
      }
    }

    // 2. Authenticate the caller (server-side, JWT verification)
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Rate limit (10 req/min per user, same as the existing /api/ai/chat)
    const rateLimitResult = checkAIChatRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitResult.retryAfter) },
        }
      );
    }

    const body = await req.json();
    recordAIChatRequest(user.id);

    // 4. Env-var check (fail fast on misconfiguration)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[api/ai-chat] Supabase env vars missing');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // 5. Forward to the Supabase Edge Function
    //    The user's bearer token is passed through so the function
    //    can call supabase.auth.getUser() with the user's identity
    //    (matching the same pattern as the existing summarize-chat
    //    function, see supabase/functions/summarize-chat/index.ts).
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') ?? `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[api/ai-chat] error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
