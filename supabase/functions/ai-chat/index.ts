// @ts-nocheck: Deno runtime types
/**
 * AI chat Edge Function — the contract's chokepoint.
 *
 * Implements `specs/004-multi-platform-expansion/contracts/ai-boundary.md`.
 *
 * The AI provider key is read from this function's environment, never from
 * the request. The function authenticates the caller via Supabase Auth,
 * forwards the user's message to Gemini, and returns the contract's
 * `AiResponse` shape. Generic error responses on failure (no underlying
 * error.message leakage — same posture as PR #22 /api/auth/sync).
 *
 * v1: returns JSON only. Streaming (`streamAiMessage`) is TODO — when
 * implemented, the response Content-Type will switch to text/event-stream
 * when `Accept: text/event-stream` is requested.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.1";
import { buildCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'gemini-pro';

// Headers that should NEVER appear in a client request. Their presence
// signals the client has the AI provider key and is trying to make a
// direct call (per contracts/ai-boundary.md §"What the apps are NOT
// allowed to do"). The Next.js proxy also checks these — this is the
// trust-boundary check, the proxy is defense-in-depth.
const FORBIDDEN_HEADERS = [
  'x-ai-provider-key',
  'x-openai-api-key',
  'x-anthropic-api-key',
  'x-gemini-api-key',
];

interface AiRequest {
  conversationId: string;
  userMessage: string;
  context: {
    language: 'ar' | 'en';
    appVersion: string;
    deviceClass: 'desktop' | 'mobile' | 'web';
  };
}

interface AiResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) });
  }

  try {
    // 1. Reject forbidden headers
    for (const h of FORBIDDEN_HEADERS) {
      if (req.headers.get(h)) {
        console.warn(`[ai-chat] rejected: ${h} header present (possible leak attempt)`);
        return new Response(
          JSON.stringify({ error: 'Forbidden: provider key header not allowed' }),
          {
            status: 403,
            headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 2. Env-var check (fail fast on misconfiguration)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[ai-chat] SUPABASE_URL or SUPABASE_ANON_KEY not set');
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Authenticate the caller via Supabase (the user's bearer token
    //    is passed through from the Next.js proxy; see apps/web/src/app/api/ai-chat/route.ts)
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Parse and validate the AiRequest (contract's wire format)
    const body = await req.json() as Partial<AiRequest>;
    if (!body.conversationId || !body.userMessage || !body.context) {
      return new Response(
        JSON.stringify({ error: 'Bad request: missing conversationId, userMessage, or context' }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }
    if (body.context.language !== 'ar' && body.context.language !== 'en') {
      return new Response(
        JSON.stringify({ error: "Bad request: context.language must be 'ar' or 'en'" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }
    if (!['desktop', 'mobile', 'web'].includes(body.context.deviceClass)) {
      return new Response(
        JSON.stringify({ error: "Bad request: context.deviceClass must be 'desktop', 'mobile', or 'web'" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Provider call. The key is read from THIS function's env, never
    //    from the request body or headers.
    if (!GEMINI_API_KEY) {
      console.error('[ai-chat] GEMINI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    const languageInstruction = body.context.language === 'ar'
      ? 'Respond in Arabic (Modern Standard Arabic).'
      : 'Respond in English.';

    const prompt = `${languageInstruction}\n\nUser: ${body.userMessage}`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: AI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const usage = result.response.usageMetadata ?? { promptTokenCount: 0, candidatesTokenCount: 0 };

    const response: AiResponse = {
      content: text,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
      },
    };

    // 6. PII-redacted logging — log the conversationId and the language,
    //    NOT the userMessage. Same posture as the existing summarize-chat
    //    function (which uses console.error for raw errors; here we use
    //    a structured single-line log instead).
    console.log(
      `[ai-chat] userId=${user.id} ` +
      `conversationId=${body.conversationId} ` +
      `language=${body.context.language} ` +
      `appVersion=${body.context.appVersion} ` +
      `deviceClass=${body.context.deviceClass} ` +
      `tokens=${response.usage.promptTokens}+${response.usage.completionTokens}`
    );

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // 7. Generic error response — never leak the underlying error.message.
    //    Server-side log keeps the full error for debugging.
    console.error('[ai-chat] error:', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
