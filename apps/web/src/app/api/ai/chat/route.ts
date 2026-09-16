import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import {
  invalidRequestBody,
  requireAuthenticatedUser,
  tooManyRequestsResponse,
} from '@/lib/api-auth';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * Server-side AI chat API endpoint
 * Used as fallback when Puter.js is unavailable
 * Protected: Requires authentication + rate limiting
 */

const chatRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Missing or invalid prompt')
    .max(10000, 'Prompt too long (max 10000 characters)'),
  model: z.string().max(200).optional(),
  mode: z.enum(['group_rag', 'cs_assistant', 'student_agent']).optional(),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

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
    // Fail-closed early: if the AI Gateway isn't configured, surface a
    // machine-readable code so the client (`assistant.ts`) can decide
    // whether to attempt the Puter.js fallback or skip the call entirely.
    // Placed BEFORE auth + rate-limit so a misconfigured deployment does
    // not spend cycles on JWT verification, DB role lookups, or rate-limit
    // budget that the user cannot consume anyway.
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json(
        {
          error: 'ai_chat_disabled',
          message:
            'AI_GATEWAY_API_KEY is not set on the server. Set it in Vercel/env.local before calling this endpoint.',
        },
        { status: 503 },
      );
    }

    // T021: Authenticate user using getUser() for JWT verification
    const auth = await requireAuthenticatedUser();
    if (!('user' in auth)) return auth.response;
    const { user } = auth;

    // T022: Check rate limit (10 req/min per user)
    const rateLimitResult = checkAIChatRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return tooManyRequestsResponse(rateLimitResult.retryAfter);
    }

    const parsed = chatRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return invalidRequestBody(
        parsed.error.issues[0]?.message ?? 'Invalid payload',
      );
    }
    const body = parsed.data;

    // Record this request for rate limiting
    recordAIChatRequest(user.id);

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
    logger.error('api/ai/chat error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
