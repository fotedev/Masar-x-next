import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  invalidRequestBody,
  requireAuthenticatedUser,
  tooManyRequestsResponse,
} from '@/lib/api-auth';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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

// The proxy is contract-preserving: the Edge Function owns the payload
// semantics, so we only enforce structure (a JSON object, size-capped)
// and forward everything else untouched.
const proxyBodySchema = z
  .record(z.string(), z.unknown())
  .refine((body) => JSON.stringify(body).length <= 50_000, {
    message: 'Payload too large (max 50000 characters)',
  });

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
    const auth = await requireAuthenticatedUser();
    if (!('user' in auth)) return auth.response;
    const { user } = auth;

    // 3. Rate limit (10 req/min per user, same as the existing /api/ai/chat)
    const rateLimitResult = checkAIChatRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return tooManyRequestsResponse(rateLimitResult.retryAfter);
    }

    const parsed = proxyBodySchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return invalidRequestBody(
        parsed.error.issues[0]?.message ?? 'Invalid payload',
      );
    }
    await recordAIChatRequest(user.id);

    // 4. Env-var check (fail fast on misconfiguration)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      logger.error('[api/ai-chat] Supabase env vars missing');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // 5. Forward to the Supabase Edge Function
    //    The user's bearer token is passed through so the function
    //    can call supabase.auth.getUser() with the user's identity
    //    (matching the same pattern as the existing summarize-chat
    //    function, see supabase/functions/summarize-chat/index.ts).
    // Forward the client's Accept header so SSE mode (Accept: text/event-stream)
    // reaches the Edge Function (spec 004 T054a end-to-end streaming).
    const acceptHeader = req.headers.get('Accept') ?? '';
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': acceptHeader,
        'Authorization': req.headers.get('Authorization') ?? `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(parsed.data),
    });

    // SSE passthrough: when the Edge Function streams (text/event-stream),
    // forward the raw body unbuffered so shared-client streaming works
    // end-to-end through this proxy (spec 004 T054a).
    const upstreamContentType = response.headers.get('content-type') ?? '';
    if (response.ok && upstreamContentType.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logger.error('[api/ai-chat] error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
