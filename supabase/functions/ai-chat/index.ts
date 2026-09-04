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
 * Two response modes, chosen by the request's `Accept` header:
 *
 *   1. JSON mode (default) - Content-Type: application/json, body is the
 *      contract's AiResponse shape. This is the original v1 behavior,
 *      unchanged.
 *
 *   2. SSE streaming mode - when the client sends `Accept: text/event-stream`
 *      (packages/shared streamAiMessage does exactly this), the function calls
 *      Gemini's generateContentStream and emits OpenAI-compatible
 *      server-sent events:
 *
 *        data: {"delta":"<text>","done":false}
 *        <blank line>
 *        ...
 *        data: {"delta":"","done":true,"usage":{"promptTokens":N,"completionTokens":M}}
 *        <blank line>
 *        data: [DONE]
 *
 *      Each frame payload mirrors AiResponseDelta from
 *      packages/shared/src/ai/types.ts field-for-field; the shared parser
 *      (packages/shared/src/ai/index.ts) yields each `data:` payload and
 *      terminates on `done: true`. JSON.stringify never emits raw newlines,
 *      so every frame is a single `data:` line. The trailing `data: [DONE]`
 *      sentinel is OpenAI-compatible and safely skipped by the shared parser.
 *
 *   Error convention (documented for both modes):
 *     - Pre-stream failures (forbidden provider-key header 403, missing env
 *       500, auth 401, request validation 400, missing Gemini key 500, and
 *       any non-2xx the upstream proxy adds such as the web proxy's 429 rate
 *       limit) return the SAME JSON error body and status as the JSON path -
 *       both modes share the identical guard sequence and only diverge at the
 *       provider call. The streaming client surfaces these through its
 *       `response.ok` check (streamAiMessage throws before reading the body).
 *     - Mid-stream failures (Gemini errors after the 200 + SSE headers were
 *       already sent, when the status can no longer change) emit one final
 *       error frame
 *       data: {"delta":"","done":true,"error":{"code":"internal_error"}}
 *       followed by data: [DONE], then close the stream. The extra `error`
 *       field survives the client's JSON.parse (it is simply not part of the
 *       AiResponseDelta type) and `done: true` guarantees the client
 *       terminates with whatever partial content it accumulated.
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

// ---------------------------------------------------------------------------
// SSE streaming support (Accept: text/event-stream mode)
// ---------------------------------------------------------------------------

const SSE_ENCODER = new TextEncoder();

/** Encode one SSE frame: `data: <payload>` + blank line. */
const sseFrame = (payload: string): Uint8Array =>
  SSE_ENCODER.encode(`data: ${payload}\n\n`);

/** Response headers for the SSE body (Deno / Supabase Edge Runtime). */
const sseResponseHeaders = (req: Request): Record<string, string> => ({
  ...buildCorsHeaders(req),
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
});

/**
 * True when the client asked for SSE streaming. Matches the exact header the
 * shared client (packages/shared/src/ai/index.ts streamAiMessage) sends, and
 * tolerates media-range parameters (`;q=...`) and multi-value Accept lists.
 */
const acceptsSse = (req: Request): boolean =>
  (req.headers.get('accept') ?? '')
    .split(',')
    .some(
      (part) => part.trim().split(';')[0].trim().toLowerCase() === 'text/event-stream'
    );

/** PII-free log context shared by both response modes. */
interface StreamLogContext {
  userId: string;
  conversationId: string;
  language: string;
  appVersion: string;
  deviceClass: string;
}

/**
 * Gemini streaming call + SSE Response. Frame contract (see module docblock):
 *
 *   data: {"delta":"...","done":false}   (one per Gemini chunk with text)
 *   data: {"delta":"","done":true,"usage":{"promptTokens":N,"completionTokens":M}}
 *   data: [DONE]
 *
 * All guards (forbidden headers, env check, auth, validation, provider key)
 * have already run before this is called, so pre-stream error responses stay
 * identical to the JSON path. Only failures after the 200 was sent become the
 * mid-stream error frame.
 */
function streamGeminiResponse(
  req: Request,
  prompt: string,
  logCtx: StreamLogContext,
): Response {
  // Aborted from cancel() below when the client disconnects, so Gemini stops
  // generating for a response nobody is reading.
  const abortController = new AbortController();
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: AI_MODEL });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await model.generateContentStream(prompt, {
          signal: abortController.signal,
        });
        for await (const chunk of result.stream) {
          // text() throws if the candidate was blocked - the catch below
          // converts that into the mid-stream error frame.
          const text = chunk.text();
          if (text) {
            controller.enqueue(
              sseFrame(JSON.stringify({ delta: text, done: false }))
            );
          }
        }
        const aggregated = await result.response;
        const usageMeta = aggregated.usageMetadata ?? {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
        };
        const usage = {
          promptTokens: usageMeta.promptTokenCount ?? 0,
          completionTokens: usageMeta.candidatesTokenCount ?? 0,
        };
        controller.enqueue(
          sseFrame(JSON.stringify({ delta: '', done: true, usage }))
        );
        controller.enqueue(sseFrame('[DONE]'));
        controller.close();

        // PII-redacted log - same fields as the JSON path.
        console.log(
          `[ai-chat][stream] userId=${logCtx.userId} ` +
          `conversationId=${logCtx.conversationId} ` +
          `language=${logCtx.language} ` +
          `appVersion=${logCtx.appVersion} ` +
          `deviceClass=${logCtx.deviceClass} ` +
          `tokens=${usage.promptTokens}+${usage.completionTokens}`
        );
      } catch (error) {
        // Mid-stream failure: the 200 was already sent, so emit the error
        // frame convention (see module docblock) instead of a new status.
        console.error(
          '[ai-chat][stream] error:',
          error instanceof Error ? error.message : 'unknown'
        );
        try {
          controller.enqueue(
            sseFrame(
              JSON.stringify({
                delta: '',
                done: true,
                error: { code: 'internal_error' },
              })
            )
          );
          controller.enqueue(sseFrame('[DONE]'));
          controller.close();
        } catch {
          // Stream already closed or client gone - nothing left to emit.
        }
      }
    },
    cancel() {
      // Client disconnected: stop the upstream Gemini stream.
      abortController.abort();
    },
  });

  return new Response(body, { status: 200, headers: sseResponseHeaders(req) });
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

    // 5a. Streaming mode: `Accept: text/event-stream` (the shared client's
    //     streamAiMessage sends this header). Every guard above has already
    //     run, so the two modes behave identically up to this point - auth,
    //     validation, and rate-limit failures return the same non-2xx JSON
    //     error body in both modes.
    if (acceptsSse(req)) {
      return streamGeminiResponse(req, prompt, {
        userId: user.id,
        conversationId: body.conversationId,
        language: body.context.language,
        appVersion: body.context.appVersion,
        deviceClass: body.context.deviceClass,
      });
    }

    // 5b. JSON mode (original v1 behavior, unchanged).
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
