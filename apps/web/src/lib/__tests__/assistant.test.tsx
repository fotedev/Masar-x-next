import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import arMessages from 'masarx-shared/messages/ar/aiAssistant.json';
import enMessages from 'masarx-shared/messages/en/aiAssistant.json';

const arCanned = arMessages.canned;
const enCanned = enMessages.canned;

/**
 * assistant.ts holds module-level state (puterFundsDepletedModel) and the
 * circuit breaker holds counters, so every test loads a fresh module via
 * resetModules + dynamic import. Only '@/lib/ai/puter-client' is mocked —
 * the Puter SDK seam. The circuit breaker, canned messages, sanitizer and
 * server-fallback stream reader all run for real.
 */
const puterClientState = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/ai/puter-client', () => ({
  getPuterClient: vi.fn(async () => puterClientState.current),
  warmupPuterClient: vi.fn(async () => {}),
  resetPuterClientCache: vi.fn(),
  resolvePuterModel: vi.fn(async (_puter: unknown, model?: string) => model || 'gpt-5.4-nano'),
  assertPuterSignedIn: vi.fn(),
  isPuterSdkSignedIn: vi.fn(() => false),
  isRecord: vi.fn((value: unknown) => typeof value === 'object' && value !== null),
  hasAsyncIterator: vi.fn((value: unknown) =>
    Boolean(value) && typeof value === 'object' && typeof (value as Record<symbol, unknown>)[Symbol.asyncIterator] === 'function',
  ),
  extractPuterChatText: vi.fn(async (response: unknown) => {
    if (typeof response === 'string') return response;
    const rec = response as { message?: { content?: unknown } } | null;
    if (rec && typeof rec.message?.content === 'string') return rec.message.content;
    return JSON.stringify(response ?? '');
  }),
  extractPuterChunkText: vi.fn((chunk: unknown) => {
    if (typeof chunk === 'string') return chunk;
    const text = (chunk as { text?: unknown } | null)?.text;
    return typeof text === 'string' ? text : '';
  }),
}));

const fetchMock = vi.fn();

import type { AiChatHistoryTurn } from '@/lib/ai/assistant';

const loadAssistant = async () => {
  vi.resetModules();
  const mod = await import('@/lib/ai/assistant');
  return mod.aiAssistant;
};

/** A streaming client: chat() yields the given chunks (each `{ text }`). */
const streamingPuter = (
  chunks: string[],
  opts: { failBefore?: boolean; failAfter?: number; error?: Error } = {},
) => ({
  auth: { isSignedIn: () => true },
  ai: {
    chat: vi.fn(async () => ({
      async *[Symbol.asyncIterator]() {
        if (opts.failBefore) throw opts.error ?? new Error('websocket is closed');
        for (let i = 0; i < chunks.length; i++) {
          yield { text: chunks[i] };
          if (opts.failAfter !== undefined && i >= opts.failAfter) {
            throw opts.error ?? new Error('websocket is closed');
          }
        }
      },
    })),
  },
});

/** A client whose chat() always rejects. */
const failingPuter = (error: Error) => ({
  auth: { isSignedIn: () => true },
  ai: { chat: vi.fn(async () => { throw error; }) },
});

const plainPuter = (response: unknown) => ({
  auth: { isSignedIn: () => true },
  ai: { chat: vi.fn(async () => response) },
});

const okStreamResponse = (text: string) => new Response(text);

beforeEach(() => {
  puterClientState.current = null;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('fallback unavailable', { status: 503 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('generateResponse — mode dispatch', () => {
  it('group_rag answers with the canned no-data message and never touches Puter', async () => {
    const spy = streamingPuter(['should not be reached']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال', undefined, { mode: 'group_rag' });
    expect(reply).toBe(arCanned.groupRagNoData);
    expect(spy.ai.chat).not.toHaveBeenCalled();
  });

  it('cs_assistant streams, sanitizes and returns the reply (opening greeting stripped for non-greeting queries)', async () => {
    const spy = streamingPuter(['مرحبا، ', 'هذه إجابة تجريبية']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('اشرح الخوارزمية', undefined, {
      mode: 'cs_assistant',
    });
    // The user asked a direct question, so the sanitizer drops the reflexive
    // "مرحبا،" opener from the reply (sanitizeAssistantReply contract).
    expect(reply).toBe('هذه إجابة تجريبية');
    expect(spy.ai.chat).toHaveBeenCalledTimes(1);
    const [prompt, options] = spy.ai.chat.mock.calls[0];
    expect(prompt).toContain('سؤال المستخدم: اشرح الخوارزمية');
    expect(options).toMatchObject({ model: 'gpt-5.4-nano', stream: true });
  });

  it('cs_assistant falls back to the full-response extractor when the provider ignores streaming', async () => {
    const spy = plainPuter({ message: { content: 'إجابة كاملة' } });
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال برمجي', undefined, {
      mode: 'cs_assistant',
    });
    expect(reply).toBe('إجابة كاملة');
  });

  it('student_agent without platform context answers the canned message without Puter', async () => {
    const spy = streamingPuter(['nope']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('ما المواد؟', undefined, {
      mode: 'student_agent',
      platformContext: '   ',
    });
    expect(reply).toBe(arCanned.noPlatformContext);
    expect(spy.ai.chat).not.toHaveBeenCalled();
  });

  it('student_agent answers strictly from the platform context prompt', async () => {
    const spy = streamingPuter(['إجابة ', 'من المنصة']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('ما المواد؟', undefined, {
      mode: 'student_agent',
      platformContext: 'مادة: هياكل بيانات',
    });
    expect(reply).toBe('إجابة من المنصة');
    const [prompt] = spy.ai.chat.mock.calls[0];
    expect(prompt).toContain('مادة: هياكل بيانات');
    expect(prompt).toContain('سؤال المستخدم: ما المواد؟');
  });

  it('resolves the locale for canned messages (en)', async () => {
    puterClientState.current = streamingPuter(['x']);
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('question', undefined, {
      mode: 'student_agent',
      platformContext: '',
      locale: 'en',
    });
    expect(reply).toBe(enCanned.noPlatformContext);
  });
});

describe('generateResponse — insufficient-funds gate (spec 012)', () => {
  const fundsError = () => new Error('payment required: insufficient_funds (no usage left)');

  it('returns the canned 💳 message when the model reports depleted funds', async () => {
    const spy = failingPuter(fundsError());
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال', undefined, { mode: 'cs_assistant' });
    expect(reply).toBe(arCanned.insufficientFunds);
    expect(reply.startsWith('💳')).toBe(true);
    // Not a transport error → single attempt, no server fallback fetch.
    expect(spy.ai.chat).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gates repeat sends with the same model without re-hitting the network', async () => {
    const spy = failingPuter(fundsError());
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    await aiAssistant.generateResponse('سؤال 1', undefined, { mode: 'cs_assistant' });
    const second = await aiAssistant.generateResponse('سؤال 2', undefined, {
      mode: 'cs_assistant',
    });
    expect(second).toBe(arCanned.insufficientFunds);
    expect(spy.ai.chat).toHaveBeenCalledTimes(1); // gate short-circuits
  });

  it('the gate is per model — a different model reaches Puter again', async () => {
    const spy = failingPuter(fundsError());
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    await aiAssistant.generateResponse('سؤال 1', undefined, { mode: 'cs_assistant' });
    await aiAssistant.generateResponse('سؤال 2', undefined, {
      mode: 'cs_assistant',
      model: 'gpt-4o',
    });
    expect(spy.ai.chat).toHaveBeenCalledTimes(2);
  });

  it('a successful response clears the depleted flag', async () => {
    const failing = failingPuter(fundsError());
    puterClientState.current = failing;
    const aiAssistant = await loadAssistant();

    await aiAssistant.generateResponse('سؤال 1', undefined, { mode: 'cs_assistant' });

    const succeeding = streamingPuter(['تم']);
    puterClientState.current = succeeding;
    await aiAssistant.generateResponse('سؤال 2', undefined, {
      mode: 'cs_assistant',
      model: 'gpt-4o', // different model bypasses the gate and succeeds
    });

    // Back to the originally depleted model — the flag is gone → Puter hit.
    puterClientState.current = failingPuter(fundsError());
    await aiAssistant.generateResponse('سؤال 3', undefined, { mode: 'cs_assistant' });
  });
});

describe('generateResponse — catch-path canned routing (the messages users see)', () => {
  it('maps a transport error on the default model to serviceUnavailable after the retry ladder', async () => {
    const spy = failingPuter(new Error('websocket is closed before the connection is established'));
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    vi.useFakeTimers();
    const promise = aiAssistant.generateResponse('سؤال', undefined, { mode: 'cs_assistant' });
    await vi.advanceTimersByTimeAsync(10_000); // covers both backoff sleeps
    const reply = await promise;

    expect(reply).toBe(arCanned.serviceUnavailable);
    expect(reply.startsWith('⚠️')).toBe(true);
    expect(spy.ai.chat).toHaveBeenCalledTimes(3); // maxAttempts
    // Server-side fallback tried once and failed (503 stub) → canned path.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/chat');
  });

  it('maps a transport error on a Claude model to claudeFallback', async () => {
    const spy = failingPuter(new Error('connection error to engine.io'));
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    vi.useFakeTimers();
    const promise = aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'cs_assistant',
      model: 'claude-sonnet-4-6',
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const reply = await promise;

    expect(reply).toBe(arCanned.claudeFallback);
    expect(reply.startsWith('⚠️')).toBe(true);
  });

  it('routes the server-side fallback text through when the endpoint answers', async () => {
    const spy = failingPuter(new Error('websocket is closed'));
    puterClientState.current = spy;
    fetchMock.mockResolvedValue(okStreamResponse('إجابة من الخادم'));
    const aiAssistant = await loadAssistant();

    vi.useFakeTimers();
    const promise = aiAssistant.generateResponse('سؤال', undefined, { mode: 'cs_assistant' });
    await vi.advanceTimersByTimeAsync(10_000);
    const reply = await promise;

    expect(reply).toBe('إجابة من الخادم');
  });

  it('maps a generic error to genericError (single attempt, no fallback fetch)', async () => {
    const spy = failingPuter(new Error('something entirely unexpected'));
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال', undefined, { mode: 'cs_assistant' });
    expect(reply).toBe(arCanned.genericError);
    expect(reply.startsWith('⚠️')).toBe(true);
    expect(spy.ai.chat).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps "not signed in" on a Claude model to the login prompt with the model suffix', async () => {
    const spy = {
      auth: { isSignedIn: () => false },
      ai: { chat: vi.fn(async () => ({})) },
    };
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'cs_assistant',
      model: 'claude-sonnet-4-6',
    });
    expect(reply.startsWith('__PUTER_AUTH_REQUIRED__')).toBe(true);
    expect(reply).toContain('(claude-sonnet-4-6)');
    expect(spy.ai.chat).not.toHaveBeenCalled();
  });

  it('uses the short variants for student_agent transport errors', async () => {
    const spy = failingPuter(new Error('websocket is closed'));
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    vi.useFakeTimers();
    const promise = aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'student_agent',
      platformContext: 'سياق',
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const reply = await promise;
    expect(reply).toBe(arCanned.serviceUnavailableShort);

    // And the Claude variant of the short message.
    const claudeSpy = failingPuter(new Error('websocket is closed'));
    puterClientState.current = claudeSpy;
    const promise2 = aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'student_agent',
      platformContext: 'سياق',
      model: 'claude-sonnet-4-6',
    });
    await vi.advanceTimersByTimeAsync(10_000);
    // Reality: the first call's transport failure already counted once, so
    // this second failure within the window OPENS the circuit — and the
    // generateStudentAgentResponse catch returns puterUnavailable directly.
    expect(await promise2).toBe(arCanned.puterUnavailable);
  });

  it('returns insufficientFunds for student_agent billing errors', async () => {
    puterClientState.current = failingPuter(new Error('insufficient_funds'));
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'student_agent',
      platformContext: 'سياق',
    });
    expect(reply).toBe(arCanned.insufficientFunds);
  });

  it('localizes the catch-path canned messages (en)', async () => {
    puterClientState.current = failingPuter(new Error('something entirely unexpected'));
    const aiAssistant = await loadAssistant();

    const reply = await aiAssistant.generateResponse('q', undefined, {
      mode: 'cs_assistant',
      locale: 'en',
    });
    expect(reply).toBe(enCanned.genericError);
  });
});

describe('streamPuterChat — partial-text retention on mid-stream failure', () => {
  it('keeps the partial text when the stream dies after content', async () => {
    const spy = streamingPuter(['جزئي — '], {
      failAfter: 0,
      error: new Error('websocket is closed before the connection is established'),
    });
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const deltas: string[] = [];
    const reply = await aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'cs_assistant',
      onDelta: (full) => deltas.push(full),
    });

    // Mid-stream failure is swallowed: the user keeps what they saw.
    expect(reply).toBe('جزئي — ');
    expect(deltas).toEqual(['جزئی — '.replace('ی', 'ي')]); // sanity on the delta itself
    expect(deltas[0]).toBe('جزئي — ');
  });

  it('rethrows when the stream dies before any content (retry ladder intact)', async () => {
    const spy = streamingPuter([], {
      failBefore: true,
      error: new Error('websocket is closed'),
    });
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    vi.useFakeTimers();
    const promise = aiAssistant.generateResponse('سؤال', undefined, { mode: 'cs_assistant' });
    await vi.advanceTimersByTimeAsync(10_000);
    const reply = await promise;
    // Zero chunks → the error escapes streamPuterChat → retry ×3 → canned.
    expect(reply).toBe(arCanned.serviceUnavailable);
    expect(spy.ai.chat).toHaveBeenCalledTimes(3);
  });
});

describe('buildChatHistoryContext — 20-turn slice + Arabic labels', () => {
  it('embeds only the last 20 turns with المستخدم/المساعد labels', async () => {
    const spy = streamingPuter(['تمام']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    const history: AiChatHistoryTurn[] = [];
    for (let i = 1; i <= 25; i++) {
      history.push({ role: i % 2 === 1 ? 'user' : 'assistant', content: `turn-${i}` });
    }

    await aiAssistant.generateResponse('السؤال الحالي', undefined, {
      mode: 'cs_assistant',
      chatHistory: history,
    });

    const [prompt] = spy.ai.chat.mock.calls[0];
    expect(prompt).toContain('سياق المحادثة السابقة (للاستمرارية فقط)');
    expect(prompt).toContain('المستخدم: turn-25');
    expect(prompt).toContain('المساعد: turn-24');
    // slice(-20) over 25 turns keeps 6..25 — the oldest kept turn (6) and
    // the oldest kept USER turn (7).
    expect(prompt).toContain('المساعد: turn-6');
    expect(prompt).toContain('المستخدم: turn-7');
    expect(prompt).not.toContain('المستخدم: turn-5'); // dropped by the slice
    expect(prompt).not.toContain('turn-1\n');
    expect(prompt).toContain('سؤال المستخدم: السؤال الحالي');
  });

  it('drops blank turns and omits the context block entirely for empty history', async () => {
    const spy = streamingPuter(['تمام']);
    puterClientState.current = spy;
    const aiAssistant = await loadAssistant();

    await aiAssistant.generateResponse('سؤال', undefined, {
      mode: 'cs_assistant',
      chatHistory: [
        { role: 'user', content: '   ' },
        { role: 'assistant', content: '' },
      ],
    });
    const [prompt] = spy.ai.chat.mock.calls[0];
    expect(prompt).not.toContain('سياق المحادثة السابقة');
  });
});

describe('generateQuiz — fence stripping + JSON slicing', () => {
  const quizJson = JSON.stringify({
    title: 'اختبار تجريبي',
    questions: [
      { question: 'س1', options: ['أ', 'ب', 'ج', 'د'], correctAnswer: 0, type: 'multiple-choice' },
      { question: 'س2', options: ['صح', 'خطأ'], correctAnswer: 1, type: 'true-false' },
    ],
  });

  it('parses a ```json-fenced response', async () => {
    puterClientState.current = plainPuter('```json\n' + quizJson + '\n```');
    const aiAssistant = await loadAssistant();

    const quiz = await aiAssistant.generateQuiz('نص المحاضرة');
    expect(quiz.title).toBe('اختبار تجريبي');
    expect(quiz.questions).toHaveLength(2);

    const [prompt, options] = puterClientState.current.ai.chat.mock.calls[0];
    expect(prompt).toContain('نص المحاضرة');
    expect(options).toMatchObject({ model: 'gpt-4o', stream: false });
  });

  it('slices from the first { to the last } around surrounding prose', async () => {
    puterClientState.current = plainPuter(`بالتأكيد! إليك الاختبار:\n${quizJson}\nبالتوفيق!`);
    const aiAssistant = await loadAssistant();

    const quiz = await aiAssistant.generateQuiz('نص');
    expect(quiz.title).toBe('اختبار تجريبي');
  });

  it('rejects malformed JSON (no silent fallback)', async () => {
    puterClientState.current = plainPuter('```json\n{"title": "بلا إغلاق\n```');
    const aiAssistant = await loadAssistant();
    await expect(aiAssistant.generateQuiz('نص')).rejects.toThrow();
  });

  it('rejects a parsed object without the quiz shape', async () => {
    puterClientState.current = plainPuter('{"not":"a quiz"}');
    const aiAssistant = await loadAssistant();
    await expect(aiAssistant.generateQuiz('نص')).rejects.toThrow('Invalid quiz JSON format');
  });
});

describe('summarizeCurrentChat — fence stripping + Arabic role labels', () => {
  const summaryJson = JSON.stringify({ summary: 'ملخص المحادثة', important_messages: [] });

  it('parses the fenced summary response', async () => {
    puterClientState.current = plainPuter('```json\n' + summaryJson + '\n```');
    const aiAssistant = await loadAssistant();

    const analysis = await aiAssistant.summarizeCurrentChat([
      { role: 'user', content: 'كيف أصلح الكود؟' },
      { role: 'assistant', content: 'استخدم try/catch' },
    ]);
    expect(analysis.summary).toBe('ملخص المحادثة');

    const [prompt] = puterClientState.current.ai.chat.mock.calls[0];
    expect(prompt).toContain('المستخدم: كيف أصلح الكود؟');
    expect(prompt).toContain('المساعد: استخدم try/catch');
  });

  it('throws for an empty conversation', async () => {
    const aiAssistant = await loadAssistant();
    await expect(aiAssistant.summarizeCurrentChat([])).rejects.toThrow(
      'No messages to summarize',
    );
  });

  it('keeps only the last 50 messages in the prompt', async () => {
    puterClientState.current = plainPuter(summaryJson);
    const aiAssistant = await loadAssistant();

    const messages = Array.from({ length: 55 }, (_, i) => ({
      role: 'user',
      content: `msg-${i + 1}`,
    }));
    await aiAssistant.summarizeCurrentChat(messages);

    const [prompt] = puterClientState.current.ai.chat.mock.calls[0];
    expect(prompt).toContain('msg-55');
    expect(prompt).toContain('msg-6'); // 50th from the end
    expect(prompt).not.toContain('msg-5\n');
    expect(prompt).not.toContain('msg-1\n');
  });
});

describe('summarizeLoadedData (retired chunk path)', () => {
  it('always throws the no-data error', async () => {
    const aiAssistant = await loadAssistant();
    await expect(aiAssistant.summarizeLoadedData()).rejects.toThrow(
      'No data loaded to summarize',
    );
  });
});

describe('getPuterStatus', () => {
  it('prefers the SDK probe and falls back to the explicit localStorage flag', async () => {
    const aiAssistant = await loadAssistant();

    expect(aiAssistant.getPuterStatus()).toEqual({
      isAIWorking: true,
      isSignedIn: false,
      status: 'puter_js',
    });

    localStorage.setItem('puter_signed_in', '1');
    expect(aiAssistant.getPuterStatus().isSignedIn).toBe(true);

    localStorage.removeItem('puter_signed_in');
    expect(aiAssistant.getPuterStatus().isSignedIn).toBe(false);
  });
});
