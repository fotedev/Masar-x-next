/**
 * Puter.js client access: lazy import, warmup, model resolution, and
 * response-text extraction (spec 004). The SDK ships no types that fit
 * our usage, so the surface is described locally by PuterClientLike.
 */

import { notePuterTransportFailure, PUTER_UNAVAILABLE_UNTIL_KEY } from './circuit-breaker';

export type PuterClientLike = {
  auth: {
    isSignedIn: () => boolean;
  };
  ai: {
    chat: (
      prompt: string,
      options?: {
        model?: string;
        stream?: boolean;
        max_tokens?: number;
        temperature?: number;
      },
    ) => Promise<unknown>;
    listModels?: (provider?: string | null) => Promise<unknown>;
  };
};

type PuterModelEntry = {
  id: string;
  provider: string;
  name?: string;
  aliases?: string[];
};

let cachedPuterClient: PuterClientLike | null = null;
let cachedPuterImport: Promise<PuterClientLike | null> | null = null;
let cachedPuterModels: Promise<Set<string>> | null = null;
let cachedPuterWarmup: Promise<void> | null = null;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Drop the cached client so the next call re-imports the SDK. */
export const resetPuterClientCache = (): void => {
  cachedPuterClient = null;
  cachedPuterImport = null;
  cachedPuterWarmup = null;
};

/**
 * SDK-truth signed-in probe for status surfaces. Reads only the cached
 * client — never triggers an import — so the UI can poll it cheaply.
 */
export const isPuterSdkSignedIn = (): boolean => {
  try {
    return Boolean(cachedPuterClient?.auth?.isSignedIn?.());
  } catch {
    return false;
  }
};

const extractTextFromContentArray = (content: unknown): string => {
  if (Array.isArray(content)) {
    return content
      .filter(item => isRecord(item) && item.type === 'text' && typeof item.text === 'string')
      .map(item => (item as { text: string }).text)
      .join('');
  }
  return '';
};

export const safeStringify = (value: unknown): string => {
  try {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // Handle objects that might have problematic toString methods
    if (typeof value === 'object') {
      // Check if it's a plain object or array
      if (Array.isArray(value)) {
        // Handle Claude 4.6 content arrays
        const textContent = extractTextFromContentArray(value);
        if (textContent) return textContent;
        return JSON.stringify(value);
      }

      // Try to get constructor name for debugging
      const constructor = value?.constructor?.name || 'Object';

      // Try JSON.stringify first
      try {
        const json = JSON.stringify(value);
        if (json && json !== '{}') return json;
      } catch {
        // JSON.stringify failed, continue to fallback
      }

      // Fallback: try to extract common properties
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;

        // Handle Claude 4.6 message structure
        if (obj.content) {
          const textContent = extractTextFromContentArray(obj.content);
          if (textContent) return textContent;
          if (typeof obj.content === 'string') return obj.content;
        }

        const content = obj.message || obj.text || obj.data;
        if (typeof content === 'string') return content;
        if (typeof content === 'object') {
          return safeStringify(content);
        }
      }

      // Last resort: return object type for debugging
      return `[${constructor} object]`;
    }

    return String(value);
  } catch (error) {
    console.warn('[AI] Failed to convert value to string:', error, value);
    return '[Conversion Error]';
  }
};

export const getPuterClient = async (): Promise<PuterClientLike | null> => {
  if (typeof window === 'undefined') return null;
  if (cachedPuterClient) return cachedPuterClient;
  if (!cachedPuterImport) {
    cachedPuterImport = import('../puter')
      .then((m) => m.default as unknown as PuterClientLike)
      .catch((error) => {
        console.warn('[AI Assistant] Failed to import Puter client:', error instanceof Error ? error.message : String(error));
        // Mark Puter as unavailable for 45 seconds
        notePuterTransportFailure(new Error('Socket.io transport initialization failed'));
        return null;
      });
  }
  const client = await cachedPuterImport;
  if (client) {
    cachedPuterClient = client;
  }
  return client;
};

export const warmupPuterClient = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PUTER_UNAVAILABLE_UNTIL_KEY);
    const until = raw ? Number(raw) : 0;
    if (Number.isFinite(until) && until > Date.now()) return;
  } catch {
    // ignore
  }
  if (cachedPuterWarmup) return cachedPuterWarmup;
  cachedPuterWarmup = import('../puter')
    .then(async (m) => {
      if (typeof m.warmupPuterAuth === 'function') {
        await m.warmupPuterAuth();
      }
    })
    .catch(() => {
      // ignore; transport errors are handled inside warmupPuterAuth when available
    });
  return cachedPuterWarmup;
};

export const hasAsyncIterator = (value: unknown): value is AsyncIterable<unknown> => {
  if (!value) return false;
  if (typeof value !== 'object') return false;
  return Symbol.asyncIterator in (value as Record<string, unknown>);
};

/**
 * Incremental counterpart of extractPuterChatText for one streaming chunk
 * (spec 011). Shapes seen from Puter: plain `{ text }` chunks, OpenAI-style
 * deltas `{ message: { content: string | Array<{ text }> } }`, and bare
 * strings. Returns '' for anything unparseable so callers skip the chunk.
 */
export const extractPuterChunkText = (chunk: unknown): string => {
  if (typeof chunk === 'string') return chunk;
  if (!isRecord(chunk)) return '';

  if (typeof chunk.text === 'string') return chunk.text;

  const textFromContent = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map(item => {
        if (typeof item === 'string') return item;
        if (isRecord(item) && typeof item.text === 'string') return item.text;
        return '';
      })
      .join('');
  };

  if (isRecord(chunk.message)) {
    const fromMessage = textFromContent(chunk.message.content);
    if (fromMessage) return fromMessage;
  }

  return textFromContent(chunk.content);
};

export const extractPuterChatText = async (response: unknown): Promise<string> => {
  if (typeof response === 'string') return response;

  // Non-streaming: Puter returns a ChatResponse with { message: { content: string|array } }
  if (isRecord(response)) {
    const message = response.message;
    if (isRecord(message)) {
      // Handle Claude 4.6 content array format
      if (Array.isArray(message.content)) {
        return extractTextFromContentArray(message.content);
      }
      // Handle traditional string content format
      if (typeof message.content === 'string') {
        return message.content;
      }
    }

    // Try to extract content from error responses
    if (isRecord(response)) {
      const error = response.error || response.message;
      if (typeof error === 'string') {
        return error;
      }
      if (isRecord(error) && typeof error.message === 'string') {
        return error.message;
      }
    }
  }

  // Streaming (future-proof): async iterable of chunks with { text: string }
  if (hasAsyncIterator(response)) {
    let out = '';
    try {
      for await (const chunk of response) {
        if (isRecord(chunk) && typeof chunk.text === 'string') {
          out += chunk.text;
        } else {
          out += safeStringify(chunk);
        }
      }
      return out;
    } catch (error) {
      console.warn('[AI] Error during streaming response extraction:', error);
      return out || safeStringify(response);
    }
  }

  // Use safe string conversion for problematic objects
  return safeStringify(response);
};

const getAvailablePuterModelIds = async (puter: PuterClientLike): Promise<Set<string>> => {
  if (cachedPuterModels) return cachedPuterModels;

  cachedPuterModels = (async () => {
    const ids = new Set<string>();
    if (!puter.ai?.listModels) return ids;
    const models = await puter.ai.listModels(null);
    if (!Array.isArray(models)) return ids;

    for (const m of models) {
      if (!isRecord(m)) continue;
      if (typeof m.id !== 'string') continue;
      ids.add(m.id);
      const aliases = (m as PuterModelEntry).aliases;
      if (Array.isArray(aliases)) {
        for (const a of aliases) {
          if (typeof a === 'string') ids.add(a);
        }
      }
    }
    return ids;
  })();

  return cachedPuterModels;
};

export const resolvePuterModel = async (
  puter: PuterClientLike,
  requestedModel?: string,
) => {
  const fallback = 'gpt-5.4-nano';
  let desired = (requestedModel || '').trim();

  // Map friendly names to exact Puter IDs based on logs and docs
  if (desired === 'GPT-4o') desired = 'gpt-4o';
  if (desired === 'o1-mini') desired = 'o1-mini';
  if (desired === 'Claude 3.5 Sonnet' || desired === 'claude-3-5-sonnet') desired = 'claude-sonnet-4-6';
  if (desired === 'Claude 4.6 Sonnet' || desired === 'claude-sonnet-4-6') desired = 'claude-sonnet-4-6';
  if (desired === 'Claude 4.6 Opus' || desired === 'claude-opus-4-6') desired = 'claude-opus-4-6';
  if (desired === 'Claude 4.5 Haiku' || desired === 'claude-haiku-4-5') desired = 'claude-haiku-4-5';

  if (!desired) return fallback;

  try {
    const available = await getAvailablePuterModelIds(puter);
    if (available.size === 0) return desired;
    if (available.has(desired)) return desired;

    // Fuzzy match as last resort
    const availableArray = Array.from(available);

    // Exact match case-insensitive
    const exactCaseMatch = availableArray.find(m => m.toLowerCase() === desired.toLowerCase());
    if (exactCaseMatch) return exactCaseMatch;

    const fuzzyMatch = availableArray.find(m => m.toLowerCase().includes(desired.toLowerCase()));
    if (fuzzyMatch) return fuzzyMatch;

    return fallback;
  } catch {
    return desired;
  }
};

export function assertPuterSignedIn(
  puter: PuterClientLike | null,
): asserts puter is PuterClientLike {
  if (!puter) throw new Error('Puter client not available');
  let signedIn = false;
  try {
    signedIn = Boolean(puter.auth?.isSignedIn?.());
  } catch {
    signedIn = false;
  }
  if (!signedIn) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('puter_signed_in');
      }
    } catch {
      // ignore
    }
    throw new Error('Puter not signed in');
  }
}
