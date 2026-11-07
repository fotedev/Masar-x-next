import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// POST /api/ai/chat. Real api-auth + NextResponse; mocked seams:
//   - '@/lib/supabase/server'  → requireAuthenticatedUser's client
//   - '@/lib/rate-limit'       → limit decision controlled per test
//   - '@/lib/metrics'          → Redis counters (also avoids server-only)
//   - 'ai'                     → streamText passthrough stub
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkAIChatRateLimit: vi.fn(),
  recordAIChatRequest: vi.fn(),
  AI_CHAT_RATE_LIMIT: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rate_limit:ai_chat:' },
}));
vi.mock('@/lib/metrics', () => ({
  recordAiQuestion: vi.fn(),
  recordFileDownload: vi.fn(),
  pingActiveUser: vi.fn(),
}));
vi.mock('ai', () => ({ streamText: vi.fn() }));

import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';
import { recordAiQuestion } from '@/lib/metrics';
import { POST, buildSystemPrompt, chatRequestSchema, maxDuration, runtime } from '../route';

const createClientMock = vi.mocked(createClient);
const checkRateLimitMock = vi.mocked(checkAIChatRateLimit);
const recordRequestMock = vi.mocked(recordAIChatRequest);
const recordAiQuestionMock = vi.mocked(recordAiQuestion);
const streamTextMock = vi.mocked(streamText);

const makeUser = (id = 'u-ai'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

const mockAuth = (user: User | null) => {
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  } as never);
};

const post = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const allowRateLimit = () => checkRateLimitMock.mockReturnValue({
  allowed: true,
  remaining: 9,
  resetTime: Date.now() + 60_000,
});

const stubGatewayKey = (value: string | undefined) => {
  if (value === undefined) vi.stubEnv('AI_GATEWAY_API_KEY', '');
  else vi.stubEnv('AI_GATEWAY_API_KEY', value);
};

beforeEach(() => {
  vi.clearAllMocks();
  stubGatewayKey('gateway-key');
  streamTextMock.mockReturnValue({
    toTextStreamResponse: () => new Response('streamed-answer', { status: 200 }),
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env gate — ordering BEFORE auth', () => {
  it('returns 503 ai_chat_disabled without consulting auth when the gateway key is missing', async () => {
    stubGatewayKey(undefined);
    mockAuth(null); // even a fully unauthenticated caller hits the env gate first

    const res = await POST(post({ prompt: 'hi' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: 'ai_chat_disabled',
      message: expect.stringContaining('AI_GATEWAY_API_KEY is not set'),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('does not consume rate-limit budget when the gateway key is missing', async () => {
    stubGatewayKey(undefined);
    mockAuth(null);

    await POST(post({ prompt: 'hi' }));
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it('proceeds past the gate once the key is present', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(200);
  });
});

describe('authentication', () => {
  it('returns the shared 401 shape for an unauthenticated caller', async () => {
    mockAuth(null);
    allowRateLimit();

    const res = await POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Valid authentication required',
    });
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After when the limit denies', async () => {
    mockAuth(makeUser());
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 42_000,
      retryAfter: 42,
    });

    const res = await POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests', retryAfter: 42 });
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('checks and records the limit keyed by the verified user id', async () => {
    mockAuth(makeUser('u-rate'));
    allowRateLimit();

    await POST(post({ prompt: 'hi' }));
    expect(checkRateLimitMock).toHaveBeenCalledWith('u-rate');
    expect(recordRequestMock).toHaveBeenCalledWith('u-rate');
    expect(recordAiQuestionMock).toHaveBeenCalledWith('u-rate');
  });
});

describe('zod schema bounds (chatRequestSchema)', () => {
  it('accepts the minimal payload and an optional valid mode/model', () => {
    const ok = chatRequestSchema.safeParse({ prompt: 'explain recursion' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.mode).toBeUndefined();
    }
    expect(
      chatRequestSchema.safeParse({
        prompt: 'x',
        model: 'anthropic/claude-sonnet-4.6',
        mode: 'student_agent',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty prompt', () => {
    const parsed = chatRequestSchema.safeParse({ prompt: '' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('Missing or invalid prompt');
  });

  it('rejects a prompt above 10000 characters', () => {
    const parsed = chatRequestSchema.safeParse({ prompt: 'a'.repeat(10_001) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Prompt too long (max 10000 characters)');
    }
  });

  it('accepts a prompt of exactly 10000 characters', () => {
    expect(chatRequestSchema.safeParse({ prompt: 'a'.repeat(10_000) }).success).toBe(true);
  });

  it('rejects a model id above 200 characters', () => {
    expect(chatRequestSchema.safeParse({ prompt: 'x', model: 'm'.repeat(201) }).success).toBe(
      false,
    );
  });

  it('rejects an unknown mode', () => {
    expect(chatRequestSchema.safeParse({ prompt: 'x', mode: 'bogus' }).success).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(chatRequestSchema.safeParse(null).success).toBe(false);
    expect(chatRequestSchema.safeParse('string').success).toBe(false);
  });
});

describe('400 handling for malformed request bodies', () => {
  it('invalid JSON body → uniform 400', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid request body' });
  });

  it('empty prompt → 400 with the schema message', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post({ prompt: '' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Invalid request body',
      message: 'Missing or invalid prompt',
    });
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('oversized prompt → 400', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post({ prompt: 'a'.repeat(10_001) }));
    expect(res.status).toBe(400);
  });

  it('unknown mode → 400', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post({ prompt: 'x', mode: 'bogus' }));
    expect(res.status).toBe(400);
  });
});

describe('streaming success path', () => {
  it('streams via toTextStreamResponse', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    const res = await POST(post({ prompt: 'explain B-trees' }));
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('streamed-answer');
  });

  it('passes the default gateway model when body.model is absent or blank', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    await POST(post({ prompt: 'p1' }));
    await POST(post({ prompt: 'p2', model: '   ' }));

    expect(streamTextMock).toHaveBeenCalledTimes(2);
    for (const call of streamTextMock.mock.calls) {
      expect(call[0].model).toBe('anthropic/claude-sonnet-4.6');
    }
  });

  it('forwards a trimmed custom model id and caps output tokens', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    await POST(post({ prompt: 'p', model: 'openai/gpt-test' }));
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-test',
        prompt: 'p',
        maxOutputTokens: 1500,
      }),
    );
  });

  it.each([
    [undefined, 'You are a helpful study assistant for university students. Answer in the user\'s language (Arabic or English).'],
    ['group_rag', 'You are a helpful study assistant for university students. Answer in the user\'s language (Arabic or English).'],
    ['cs_assistant', "You are a computer science tutor. Answer concisely in the user's language. Show code examples when relevant."],
    ['student_agent', 'You are a Masar X platform assistant. Help students find summaries, courses, and quizzes on the platform.'],
  ])('buildSystemPrompt(%s) matches the shipped system prompt', (mode, expected) => {
    expect(buildSystemPrompt(mode as never)).toBe(expected);
  });

  it('the POSTed mode selects the system prompt handed to streamText', async () => {
    mockAuth(makeUser());
    allowRateLimit();

    await POST(post({ prompt: 'explain Big-O', mode: 'cs_assistant' }));
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: buildSystemPrompt('cs_assistant'),
      }),
    );
  });

  it('buildSystemPrompt falls back to the generic tutor for unknown modes', () => {
    expect(buildSystemPrompt('nonsense' as never)).toBe(
      'You are a helpful study assistant for university students. Answer in the user\'s language (Arabic or English).',
    );
  });
});

describe('error containment', () => {
  it('a thrown streamText maps to the uniform 500', async () => {
    mockAuth(makeUser());
    allowRateLimit();
    streamTextMock.mockImplementation(() => {
      throw new Error('gateway exploded');
    });

    const res = await POST(post({ prompt: 'p' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
  });
});

describe('route metadata', () => {
  it('pins the nodejs runtime and maxDuration', () => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration).toBe(30);
  });
});
