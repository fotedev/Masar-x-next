import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * puter-client.ts keeps four module-level caches (client, import, models,
 * warmup), so every test builds a fresh module via resetModules + dynamic
 * import. The '../puter' SDK seam is mocked at the module level (hoisted)
 * and each test re-points its `default` before importing.
 */
const puterModuleMock = vi.hoisted(() => ({
  failImport: false,
  default: {
    auth: { isSignedIn: () => false },
    ai: { chat: async () => ({}) },
  },
  warmupPuterAuth: vi.fn(async () => ({ isSignedIn: false })),
}));

vi.mock('../puter', () => ({
  // vi.resetModules() clears the module registry but NOT the mock registry —
  // the factory result is built once and reused, so plain property reads
  // would freeze the first test's client for the whole file. Getters keep
  // every import() reflecting the current mock state.
  get default() {
    if (puterModuleMock.failImport) throw new Error('sdk load failed');
    return puterModuleMock.default;
  },
  get warmupPuterAuth() {
    return puterModuleMock.warmupPuterAuth;
  },
}));

async function freshModule() {
  vi.resetModules();
  return import('../ai/puter-client');
}

const makePuter = ({
  signedIn = false,
  models = null as unknown[] | null,
}: { signedIn?: boolean; models?: unknown[] | null } = {}) => ({
  auth: { isSignedIn: () => signedIn },
  ai: {
    chat: vi.fn(async () => ({})),
    listModels: models === null ? undefined : vi.fn(async () => models),
  },
});

const claudeContent = [
  { type: 'text', text: 'مرحبا' },
  { type: 'tool_use', id: 't1' }, // non-text entries are dropped
  { type: 'text', text: ' بك' },
];

beforeEach(() => {
  puterModuleMock.failImport = false;
  puterModuleMock.warmupPuterAuth.mockClear();
  puterModuleMock.default = {
    auth: { isSignedIn: () => false },
    ai: { chat: async () => ({}) },
  };
  localStorage.clear();
});

describe('extractPuterChatText — non-streaming extractor', () => {
  it('passes strings through', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(extractPuterChatText('plain answer')).resolves.toBe('plain answer');
  });

  it('unwraps { message: { content: string } }', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(
      extractPuterChatText({ message: { content: 'the answer' } }),
    ).resolves.toBe('the answer');
  });

  it('joins Claude-style content arrays, dropping non-text entries', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(
      extractPuterChatText({ message: { content: claudeContent } }),
    ).resolves.toBe('مرحبا بك');
  });

  it('throws on error-shaped responses (P1.10: errors never surface as chat text)', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(extractPuterChatText({ error: 'boom' })).rejects.toThrow('boom');
    await expect(extractPuterChatText({ error: { message: 'inner boom' } })).rejects.toThrow(
      'inner boom',
    );
  });

  it('treats a plain-string message as an error shape (throws, P1.10)', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(extractPuterChatText({ message: 'string message' })).rejects.toThrow(
      'string message',
    );
  });

  it('consumes an async-iterable fallback of { text } chunks', async () => {
    const { extractPuterChatText } = await freshModule();
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { text: 'a' };
        yield { text: 'b' };
      },
    };
    await expect(extractPuterChatText(stream)).resolves.toBe('ab');
  });

  it('stringifies non-record chunks via safeStringify in the iterable fallback', async () => {
    const { extractPuterChatText } = await freshModule();
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield 42;
        yield { foo: 'bar' };
      },
    };
    await expect(extractPuterChatText(stream)).resolves.toBe('42{"foo":"bar"}');
  });

  it('keeps partial text when the iterable throws mid-stream', async () => {
    const { extractPuterChatText } = await freshModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { text: 'partial-' };
        throw new Error('websocket is closed');
      },
    };
    await expect(extractPuterChatText(stream)).resolves.toBe('partial-');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to safeStringify(response) when the iterable throws before any chunk', async () => {
    const { extractPuterChatText } = await freshModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stream = {
      kind: 'streaming-response',
      async *[Symbol.asyncIterator]() {
        throw new Error('network dropped');
      },
    };
    await expect(extractPuterChatText(stream)).resolves.toBe('{"kind":"streaming-response"}');
    warn.mockRestore();
  });

  it('delegates unparseable objects to safeStringify', async () => {
    const { extractPuterChatText } = await freshModule();
    await expect(extractPuterChatText({ message: { content: 'x' }, extra: true })).resolves.toBe(
      'x',
    ); // content wins via the message branch
    await expect(extractPuterChatText(12345)).resolves.toBe('12345');
    await expect(extractPuterChatText(null)).resolves.toBe('');
  });
});

describe('safeStringify (exported seam)', () => {
  it('maps primitives', async () => {
    const { safeStringify } = await freshModule();
    expect(safeStringify(null)).toBe('');
    expect(safeStringify(undefined)).toBe('');
    expect(safeStringify('s')).toBe('s');
    expect(safeStringify(5)).toBe('5');
    expect(safeStringify(true)).toBe('true');
  });

  it('extracts text from Claude content arrays, JSON for the rest', async () => {
    const { safeStringify } = await freshModule();
    expect(safeStringify(claudeContent)).toBe('مرحبا بك');
    expect(safeStringify([{ nope: 1 }])).toBe('[{"nope":1}]');
  });

  it('JSON-stringifies serializable objects first (content/message stay JSON)', async () => {
    const { safeStringify } = await freshModule();
    // Reality: the JSON.stringify attempt wins for anything serializable —
    // the content/message/text/data extraction is a fallback for objects
    // stringify cannot handle.
    expect(safeStringify({ content: 'plain content' })).toBe('{"content":"plain content"}');
    expect(safeStringify({ message: 'nested message' })).toBe('{"message":"nested message"}');
    expect(safeStringify({ data: 'payload' })).toBe('{"data":"payload"}');
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
  });

  it('falls back to content/message/text/data extraction when JSON.stringify fails', async () => {
    const { safeStringify } = await freshModule();
    // Circular structures break JSON.stringify → the extraction branch runs.
    const circularWithContent: Record<string, unknown> = { content: claudeContent };
    circularWithContent.self = circularWithContent;
    expect(safeStringify(circularWithContent)).toBe('مرحبا بك');

    const circularWithMessage: Record<string, unknown> = { message: 'nested message' };
    circularWithMessage.self = circularWithMessage;
    expect(safeStringify(circularWithMessage)).toBe('nested message');
  });

  it('labels opaque objects instead of emitting [object Object]', async () => {
    const { safeStringify } = await freshModule();
    expect(safeStringify({})).toBe('[Object object]');
  });
});

describe('getPuterClient + resetPuterClientCache', () => {
  it('returns null outside a browser (window undefined in node env)', async () => {
    // Simulated by deleting window from the jsdom global.
    const { getPuterClient } = await freshModule();
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      await expect(getPuterClient()).resolves.toBeNull();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = originalWindow;
    }
  });

  it('caches the imported client across calls', async () => {
    const clientA = makePuter();
    puterModuleMock.default = clientA as never;
    const { getPuterClient } = await freshModule();

    await expect(getPuterClient()).resolves.toBe(clientA);
    // Swap the SDK underneath — the cache must still win.
    puterModuleMock.default = makePuter() as never;
    await expect(getPuterClient()).resolves.toBe(clientA);
  });

  it('resetPuterClientCache forces a fresh import', async () => {
    const clientA = makePuter();
    puterModuleMock.default = clientA as never;
    const { getPuterClient, resetPuterClientCache } = await freshModule();
    await expect(getPuterClient()).resolves.toBe(clientA);

    const clientB = makePuter();
    puterModuleMock.default = clientB as never;
    resetPuterClientCache();
    await expect(getPuterClient()).resolves.toBe(clientB);
  });

  it('maps a failed SDK import to null and sticks with null until reset', async () => {
    puterModuleMock.failImport = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getPuterClient, resetPuterClientCache } = await freshModule();

    await expect(getPuterClient()).resolves.toBeNull();
    await expect(getPuterClient()).resolves.toBeNull();

    puterModuleMock.failImport = false;
    const client = makePuter();
    puterModuleMock.default = client as never;
    // Still null — the failed import promise is cached.
    await expect(getPuterClient()).resolves.toBeNull();
    resetPuterClientCache();
    await expect(getPuterClient()).resolves.toBe(client);
    warn.mockRestore();
  });
});

describe('warmupPuterClient', () => {
  it('is a no-op outside a browser', async () => {
    const { warmupPuterClient } = await freshModule();
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      await expect(warmupPuterClient()).resolves.toBeUndefined();
      expect(puterModuleMock.warmupPuterAuth).not.toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = originalWindow;
    }
  });

  it('skips the import while the transport cooldown is active', async () => {
    localStorage.setItem('puter_unavailable_until', String(Date.now() + 60_000));
    const { warmupPuterClient } = await freshModule();
    await warmupPuterClient();
    expect(puterModuleMock.warmupPuterAuth).not.toHaveBeenCalled();
  });

  it('calls warmupPuterAuth once and caches the warmup promise', async () => {
    const { warmupPuterClient, resetPuterClientCache } = await freshModule();
    await warmupPuterClient();
    await warmupPuterClient();
    expect(puterModuleMock.warmupPuterAuth).toHaveBeenCalledTimes(1);

    resetPuterClientCache();
    await warmupPuterClient();
    expect(puterModuleMock.warmupPuterAuth).toHaveBeenCalledTimes(2);
  });

  it('survives warmupPuterAuth throwing', async () => {
    puterModuleMock.warmupPuterAuth.mockRejectedValueOnce(new Error('transport down'));
    const { warmupPuterClient } = await freshModule();
    await expect(warmupPuterClient()).resolves.toBeUndefined();
  });
});

describe('isPuterSdkSignedIn', () => {
  it('returns false while no client is cached', async () => {
    const { isPuterSdkSignedIn } = await freshModule();
    expect(isPuterSdkSignedIn()).toBe(false);
  });

  it('reflects the cached client auth state (and swallows probe errors)', async () => {
    puterModuleMock.default = makePuter({ signedIn: true }) as never;
    const { getPuterClient, isPuterSdkSignedIn } = await freshModule();
    await getPuterClient();
    expect(isPuterSdkSignedIn()).toBe(true);
  });
});

describe('hasAsyncIterator', () => {
  it('accepts only objects with Symbol.asyncIterator', async () => {
    const { hasAsyncIterator } = await freshModule();
    expect(hasAsyncIterator({ async *[Symbol.asyncIterator]() {} })).toBe(true);
    expect(hasAsyncIterator({})).toBe(false);
    expect(hasAsyncIterator('string')).toBe(false);
    expect(hasAsyncIterator(null)).toBe(false);
    expect(hasAsyncIterator(undefined)).toBe(false);
    expect(hasAsyncIterator(42)).toBe(false);
  });
});

describe('assertPuterSignedIn', () => {
  it('throws the client-unavailable error for null', async () => {
    const { assertPuterSignedIn } = await freshModule();
    expect(() => assertPuterSignedIn(null)).toThrow('Puter client not available');
  });

  it('accepts a signed-in client', async () => {
    const { assertPuterSignedIn } = await freshModule();
    expect(() => assertPuterSignedIn(makePuter({ signedIn: true }) as never)).not.toThrow();
  });

  it('clears the puter_signed_in flag and throws when not signed in', async () => {
    localStorage.setItem('puter_signed_in', '1');
    const { assertPuterSignedIn } = await freshModule();
    expect(() => assertPuterSignedIn(makePuter({ signedIn: false }) as never)).toThrow(
      'Puter not signed in',
    );
    expect(localStorage.getItem('puter_signed_in')).toBeNull();
  });

  it('treats a throwing isSignedIn probe as signed-out', async () => {
    const { assertPuterSignedIn } = await freshModule();
    const hostile = {
      auth: {
        isSignedIn: () => {
          throw new Error('sdk not ready');
        },
      },
      ai: {},
    };
    expect(() => assertPuterSignedIn(hostile as never)).toThrow('Puter not signed in');
  });
});

describe('resolvePuterModel', () => {
  const withModels = (models: unknown[]) => makePuter({ models }) as never;

  it('maps friendly aliases to exact Puter IDs', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(resolvePuterModel(withModels([]), 'GPT-4o')).resolves.toBe('gpt-4o');
    await expect(resolvePuterModel(withModels([]), 'Claude 3.5 Sonnet')).resolves.toBe(
      'claude-sonnet-4-6',
    );
    await expect(resolvePuterModel(withModels([]), 'claude-3-5-sonnet')).resolves.toBe(
      'claude-sonnet-4-6',
    );
    await expect(resolvePuterModel(withModels([]), 'Claude 4.6 Opus')).resolves.toBe(
      'claude-opus-4-6',
    );
    await expect(resolvePuterModel(withModels([]), 'Claude 4.5 Haiku')).resolves.toBe(
      'claude-haiku-4-5',
    );
  });

  it('returns the fallback for empty/missing requests', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(resolvePuterModel(withModels([]), undefined)).resolves.toBe('gpt-5.4-nano');
    await expect(resolvePuterModel(withModels([]), '   ')).resolves.toBe('gpt-5.4-nano');
  });

  it('returns the desired id untouched when listModels is missing or empty', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(resolvePuterModel(makePuter() as never, 'gpt-9-turbo')).resolves.toBe(
      'gpt-9-turbo',
    );
    await expect(resolvePuterModel(withModels([]), 'gpt-9-turbo')).resolves.toBe('gpt-9-turbo');
  });

  it('matches case-insensitively against the model list', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(withModels([{ id: 'GPT-5.4-Nano' }]), 'gpt-5.4-nano'),
    ).resolves.toBe('GPT-5.4-Nano');
  });

  it('fuzzy-matches as a last resort before the fallback', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(withModels([{ id: 'claude-sonnet-4-6' }, { id: 'gpt-4o' }]), 'claude'),
    ).resolves.toBe('claude-sonnet-4-6');
  });

  it('falls back to gpt-5.4-nano when nothing matches', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(withModels([{ id: 'llama-3' }, { id: 'mistral' }]), 'gpt-9'),
    ).resolves.toBe('gpt-5.4-nano');
  });

  it('adds aliases from the model list to the candidate set', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(withModels([{ id: 'x-1', aliases: ['gpt-5.4-nano'] }]), 'gpt-5.4-nano'),
    ).resolves.toBe('gpt-5.4-nano');
  });

  it('ignores malformed model entries and non-array listModels results', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(withModels([null, 'string', { nope: 1 }, { id: 7 }]), 'model-x'),
    ).resolves.toBe('model-x'); // candidate set stays empty → desired returned
    await expect(
      resolvePuterModel({ auth: {}, ai: { listModels: async () => 'not-an-array' } } as never, 'm'),
    ).resolves.toBe('m');
  });

  it('caches the listModels result across calls and client resets', async () => {
    const puter = makePuter({ models: [{ id: 'gpt-5.4-nano' }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listModels = (puter.ai as any).listModels as ReturnType<typeof vi.fn>;
    const { resolvePuterModel, resetPuterClientCache } = await freshModule();

    await resolvePuterModel(puter as never, 'gpt-5.4-nano');
    await resolvePuterModel(puter as never, 'gpt-5.4-nano');
    expect(listModels).toHaveBeenCalledTimes(1);

    resetPuterClientCache();
    await resolvePuterModel(puter as never, 'gpt-5.4-nano');
    expect(listModels).toHaveBeenCalledTimes(1); // models cache outlives client reset
  });

  it('returns the desired id when listModels throws', async () => {
    const { resolvePuterModel } = await freshModule();
    await expect(
      resolvePuterModel(
        { auth: {}, ai: { listModels: async () => { throw new Error('rpc down'); } } } as never,
        'desired-model',
      ),
    ).resolves.toBe('desired-model');
  });
});
