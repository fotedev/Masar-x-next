import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';

/**
 * Server-side AI chat API endpoint
 * Used as fallback when Puter.js is unavailable
 * Protected: Requires authentication + rate limiting
 */

type ChatRequest = {
  prompt: string;
  model?: string;
  mode?: 'group_rag' | 'cs_assistant' | 'student_agent';
};

/**
 * System prompt per chat mode.
 * Keep concise — the model produces the actual response.
 */
function buildSystemPrompt(mode: ChatRequest['mode']): string {
  switch (mode) {
    case 'cs_assistant':
      return "You are a computer science tutor. Answer concisely in the user's language. Show code examples when relevant.";
    case 'student_agent':
      return 'You are a Masar X platform assistant. Help students find summaries, courses, and quizzes on the platform.';
    case 'group_rag':
    default:
      return 'You are a helpful study assistant for university students. Answer in the user\'s language (Arabic or English).';
  }
}

/**
 * Default model for the Vercel AI Gateway.
 * Override via the request body's `model` field. Must be a valid
 * gateway model id — see https://ai-gateway.vercel.sh/v1/models.
 */
const DEFAULT_GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6';

export async function POST(request: NextRequest) {
  try {
    // T021: Authenticate user using getUser() for JWT verification
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication required' },
        { status: 401 }
      );
    }

    // T022: Check rate limit (10 req/min per user)
    const rateLimitResult = await checkAIChatRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter)
          }
        }
      );
    }

    const body = await request.json() as ChatRequest;

    // T023: Validate prompt
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    // Validate request size
    if (body.prompt.length > 10000) {
      return NextResponse.json(
        { error: 'Prompt too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    // Record this request for rate limiting
    await recordAIChatRequest(user.id);

    // Explicit 503 if the AI Gateway isn't configured — fail loud rather than
    // silently returning a fake response (would defeat the purpose of the route).
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json(
        {
          error: 'AI gateway not configured',
          message: 'AI_GATEWAY_API_KEY is not set on the server. Set it in Vercel/env.local before calling this endpoint.',
        },
        { status: 503 }
      );
    }

    // Stream a real LLM response via the Vercel AI Gateway.
    // The AI SDK reads AI_GATEWAY_API_KEY automatically and resolves
    // string model ids (e.g. 'anthropic/claude-sonnet-4.6') to the gateway.
    const modelId = body.model?.trim() || DEFAULT_GATEWAY_MODEL;

    const result = streamText({
      model: modelId,
      system: buildSystemPrompt(body.mode),
      prompt: body.prompt,
      maxOutputTokens: 1500,
    });

    // toTextStreamResponse() sets text/plain + chunked transfer encoding.
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
