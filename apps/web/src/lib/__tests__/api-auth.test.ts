import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// The docblock on api-auth.ts says this contract "must not drift": same 401
// body, same 429 body + Retry-After header, uniform 400 shape. These tests
// pin all three. Only the server-client import seam is mocked — NextResponse
// itself is the real one so the status/headers/body contract is checked
// end-to-end.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import {
  invalidRequestBody,
  requireAuthenticatedUser,
  tooManyRequestsResponse,
} from '../api-auth';
import { createClient } from '@/lib/supabase/server';

const createClientMock = vi.mocked(createClient);

const makeUser = (id = 'u-1'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'student@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

beforeEach(() => {
  createClientMock.mockReset();
});

describe('requireAuthenticatedUser', () => {
  it('returns { user } on a verified JWT', async () => {
    const user = makeUser('u-ok');
    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
    } as never);

    const result = await requireAuthenticatedUser();
    expect('user' in result && result.user.id).toBe('u-ok');
    expect('response' in result).toBe(false);
  });

  it('returns a 401 response with the exact error body when getUser errors', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: 'JWT expired', code: 401, status: 401 },
        }),
      },
    } as never);

    const result = await requireAuthenticatedUser();
    expect('response' in result).toBe(true);
    const response = ('response' in result && result.response) as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Valid authentication required',
    });
  });

  it('returns a 401 response when getUser succeeds with no user (anon caller)', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);

    const result = await requireAuthenticatedUser();
    expect('response' in result).toBe(true);
    const response = ('response' in result && result.response) as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Valid authentication required',
    });
  });

  it('propagates a createClient failure (crash, not a silent 401)', async () => {
    createClientMock.mockRejectedValue(new Error('cookie store unavailable'));
    await expect(requireAuthenticatedUser()).rejects.toThrow('cookie store unavailable');
  });
});

describe('tooManyRequestsResponse — 429 + Retry-After contract', () => {
  it('echoes the provided retryAfter in the body, message and header', async () => {
    const response = tooManyRequestsResponse(30);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    await expect(response.json()).resolves.toEqual({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Try again in 30 seconds.',
      retryAfter: 30,
    });
  });

  it('falls back to 60 seconds when retryAfter is undefined', async () => {
    const response = tooManyRequestsResponse(undefined);
    expect(response.headers.get('Retry-After')).toBe('60');
    const body = await response.json();
    expect(body.retryAfter).toBe(60);
    expect(body.message).toBe('Rate limit exceeded. Try again in 60 seconds.');
  });
});

describe('invalidRequestBody — uniform 400 shape', () => {
  it('returns 400 with error + forwarded message', async () => {
    const response = invalidRequestBody('prompt must be a string');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
      message: 'prompt must be a string',
    });
  });

  it('keeps the shape stable across different messages (contract, not free-form)', async () => {
    const a = await invalidRequestBody('mode is invalid').json();
    const b = await invalidRequestBody('history malformed').json();
    expect(Object.keys(a).sort()).toEqual(['error', 'message']);
    expect(Object.keys(b).sort()).toEqual(['error', 'message']);
  });
});
