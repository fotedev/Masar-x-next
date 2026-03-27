import { supabase } from '@/lib/supabase';
import type { MessageWithSender } from '@/types/database';
import { logger } from '@/lib/logger';

type PuterClientLike = {
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

let cachedPuterClient: PuterClientLike | null = null;
let cachedPuterImport: Promise<PuterClientLike | null> | null = null;
let cachedPuterModels: Promise<Set<string>> | null = null;

let cachedPuterWarmup: Promise<void> | null = null;

const PUTER_UNAVAILABLE_UNTIL_KEY = 'puter_unavailable_until';

const PUTER_UNAVAILABLE_MESSAGE_AR = '⚠️ خدمة الذكاء الاصطناعي غير متاحة حالياً. حاول لاحقاً.';
const PUTER_UNAVAILABLE_MESSAGE_EN = '⚠️ AI service is temporarily unavailable. Please try again later.';

let puterCircuitOpenUntilMs = 0;
let puterTransportFailureCount = 0;
let puterLastTransportFailureAtMs = 0;
let puterLastCircuitLogAtMs = 0;

const isPuterCircuitOpen = () => Date.now() < puterCircuitOpenUntilMs;

const BREVITY_INSTRUCTION = `

إرشادات الإيجاز (مهم):
- كن مختصراً ومباشراً افتراضياً.
- لا تبدأ كل رد بتحية. ابدأ مباشرة بالإجابة.
- فقط إذا بدأ المستخدم بتحية (hi/hello/السلام عليكم/أهلاً) أو كانت أول رسالة في المحادثة: رد بتحية قصيرة مرة واحدة.
- إذا كانت رسالة المستخدم قصيرة جداً (مثل: hi / ok / ?) اسأل من 1 إلى 3 أسئلة توضيحية قصيرة كحد أقصى.
- لا تكتب ردود طويلة أو أمثلة إلا إذا طلب المستخدم ذلك أو كانت ضرورية لفهم الحل.
`;

const userMessageLooksLikeGreeting = (query: string) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return false;
  return (
    q === 'hi' ||
    q === 'hello' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.includes('السلام عليكم') ||
    q.includes('سلام عليكم') ||
    q.includes('اهلا') ||
    q.includes('أهلا') ||
    q.includes('أهلاً') ||
    q.includes('مرحبا') ||
    q.includes('مرحباً') ||
    q.includes('مرحبًا')
  );
};

const stripOpeningGreeting = (text: string) => {
  const raw = String(text ?? '');
  const trimmedStart = raw.replace(/^\s+/, '');

  const patterns: RegExp[] = [
    /^((?:أهلاً|أهلا|اهلا|مرحباً|مرحبًا|مرحبا|السلام عليكم|سلام عليكم)(?:\s+بك|\s+وسهلاً|\s+وسهلا)?)\s*[!！\.،,:؛\-–—]*\s*/i,
    /^(hi|hello|hey)\s*[!！\.，,:;\-–—]*\s*/i,
  ];

  for (const p of patterns) {
    if (p.test(trimmedStart)) {
      const next = trimmedStart.replace(p, '');
      return next.replace(/^\s+/, '');
    }
  }

  return raw;
};

const enforceFencedCodeBlocks = (text: string) => {
  const raw = String(text ?? '');
  if (raw.includes('```')) return raw;

  const lines = raw.split(/\r?\n/);
  const isCodeLine = (line: string) => {
    if (/^\s{4,}\S/.test(line) || /^\t+\S/.test(line)) return true;
    if (/^\s*(def|class)\s+\w+/.test(line)) return true;
    if (/^\s*(function|const|let|var)\s+/.test(line)) return true;
    if (/^\s*import\s+/.test(line)) return true;
    if (/^\s*if\s*\(.*\)\s*\{?\s*$/.test(line)) return true;
    if (/^\s*return\s+/.test(line)) return true;
    if (/^\s*#include\s+/.test(line)) return true;
    return false;
  };

  let bestStart = -1;
  let bestEnd = -1;
  let currentStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const code = isCodeLine(lines[i]);
    if (code && currentStart === -1) currentStart = i;
    if (!code && currentStart !== -1) {
      const end = i - 1;
      if (end - currentStart + 1 >= 2 && end - currentStart > bestEnd - bestStart) {
        bestStart = currentStart;
        bestEnd = end;
      }
      currentStart = -1;
    }
  }
  if (currentStart !== -1) {
    const end = lines.length - 1;
    if (end - currentStart + 1 >= 2 && end - currentStart > bestEnd - bestStart) {
      bestStart = currentStart;
      bestEnd = end;
    }
  }

  if (bestStart === -1) return raw;

  const before = lines.slice(0, bestStart).join('\n').replace(/\s+$/, '');
  const codeBlock = lines.slice(bestStart, bestEnd + 1).join('\n').replace(/^\s+\n+/, '').replace(/\n+\s+$/, '');
  const after = lines.slice(bestEnd + 1).join('\n').replace(/^\s+/, '');

  const wrapped = `${before}${before ? '\n\n' : ''}\
\`\`\`\n${codeBlock}\n\`\`\`\n${after}`;
  return wrapped.replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeAssistantReply = (query: string, reply: string) => {
  let out = String(reply ?? '');
  if (!out) return out;

  if (!userMessageLooksLikeGreeting(query)) {
    out = stripOpeningGreeting(out);
  }
  out = enforceFencedCodeBlocks(out);
  return out;
};

const asErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const isPuterAuthError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();
  return msg.includes('not signed in') || msg.includes('not signed') || msg.includes('signed in');
};

const isClaudeLikeModel = (model?: string) => {
  const m = (model || '').toLowerCase();
  return m.includes('claude');
};

const formatPuterNeedsLoginMessage = (model?: string) => {
  const modelLabel = model ? ` (${model})` : '';
  return `__PUTER_AUTH_REQUIRED__\n⚠️ يلزم تسجيل الدخول إلى Puter لتفعيل هذا النموذج${modelLabel}.\n\nاضغط زر "تسجيل الدخول" بالأسفل ثم أعد المحاولة.`;
};

const ZANE_UI_INSTRUCTION = `
تعليمات واجهة تفاعلية (zane-ui) عند الحاجة (مهم):
- إذا احتجت توضيح قبل المتابعة، اسأل من 1 إلى 3 أسئلة قصيرة كحد أقصى.
- ثم أضف بلوك JSON واحد داخل كود بلوك بصيغة:
\n\n\`\`\`zane-ui
{"type":"buttons","title":"...","buttons":[{"label":"...","message":"..."}]}
\`\`\`
- اجعل الأزرار 2 إلى 4 فقط.
- قيمة message هي النص الذي سيتم إرساله عند الضغط.
- لا تضع أكثر من بلوك zane-ui واحد في الرد.
`;

const isPuterTransportError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();
  return (
    msg.includes('socket.io') ||
    msg.includes('engine.io') ||
    msg.includes('transport') ||
    msg.includes('websocket') ||
    msg.includes('polling') ||
    msg.includes('400') ||
    msg.includes('bad request') ||
    msg.includes('network')
  );
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withPuterRetry = async <T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> => {
  const maxAttempts = Math.max(1, Math.min(5, opts?.maxAttempts ?? 3));
  const baseDelayMs = Math.max(200, opts?.baseDelayMs ?? 500);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fn();
      puterTransportFailureCount = 0;
      puterLastTransportFailureAtMs = 0;
      return res;
    } catch (e) {
      lastError = e;
      if (!isPuterTransportError(e) || attempt >= maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
};

const notePuterTransportFailure = (error: unknown) => {
  if (!isPuterTransportError(error)) return;

  const now = Date.now();
  const sinceLast = now - (puterLastTransportFailureAtMs || 0);
  const withinWindow = sinceLast >= 0 && sinceLast < 60_000;
  puterTransportFailureCount = withinWindow ? puterTransportFailureCount + 1 : 1;
  puterLastTransportFailureAtMs = now;

  if (puterTransportFailureCount >= 2) {
    puterCircuitOpenUntilMs = now + 45_000;
    if (now - puterLastCircuitLogAtMs > 45_000) {
      puterLastCircuitLogAtMs = now;
      logger.warn('Puter transport unavailable; opening circuit breaker', {
        openUntil: new Date(puterCircuitOpenUntilMs).toISOString(),
        error: asErrorMessage(error),
      });
    }
  }
};

const getPuterUnavailableMessage = () => `${PUTER_UNAVAILABLE_MESSAGE_AR}\n\n${PUTER_UNAVAILABLE_MESSAGE_EN}`;

/**
 * Fallback: Call server-side AI endpoint when Puter is unavailable
 */
const tryServerSideFallback = async (
  prompt: string,
  mode: AiAssistantMode = 'group_rag',
): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode,
      }),
    });

    if (!response.ok) {
      console.warn('[AI Fallback] Server responded with status:', response.status);
      return null;
    }

    const data = await response.json() as { message?: string };
    return data.message || null;
  } catch (error) {
    console.warn('[AI Fallback] Error calling server endpoint:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

type PuterModelEntry = {
  id: string;
  provider: string;
  name?: string;
  aliases?: string[];
};

const getPuterClient = async (): Promise<PuterClientLike | null> => {
  if (typeof window === 'undefined') return null;
  if (cachedPuterClient) return cachedPuterClient;
  if (!cachedPuterImport) {
    cachedPuterImport = import('./puter')
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

const warmupPuterClient = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PUTER_UNAVAILABLE_UNTIL_KEY);
    const until = raw ? Number(raw) : 0;
    if (Number.isFinite(until) && until > Date.now()) return;
  } catch {
    // ignore
  }
  if (cachedPuterWarmup) return cachedPuterWarmup;
  cachedPuterWarmup = import('./puter')
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

const hasAsyncIterator = (value: unknown): value is AsyncIterable<unknown> => {
  if (!value) return false;
  if (typeof value !== 'object') return false;
  return Symbol.asyncIterator in (value as Record<string, unknown>);
};

const extractPuterChatText = async (response: unknown): Promise<string> => {
  if (typeof response === 'string') return response;

  // Non-streaming: Puter returns a ChatResponse with { message: { content: string } }
  if (isRecord(response)) {
    const message = response.message;
    if (isRecord(message) && typeof message.content === 'string') {
      return message.content;
    }
  }

  // Streaming (future-proof): async iterable of chunks with { text: string }
  if (hasAsyncIterator(response)) {
    let out = '';
    for await (const chunk of response) {
      if (isRecord(chunk) && typeof chunk.text === 'string') {
        out += chunk.text;
      } else {
        out += String(chunk ?? '');
      }
    }
    return out;
  }

  return String(response);
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

const resolvePuterModel = async (puter: PuterClientLike, requestedModel?: string) => {
  const fallback = 'gpt-5-nano';
  const desired = (requestedModel || '').trim();
  if (!desired) return fallback;

  try {
    const available = await getAvailablePuterModelIds(puter);
    if (available.size === 0) return desired;
    if (available.has(desired)) return desired;
    return fallback;
  } catch {
    return desired;
  }
};

function assertPuterSignedIn(
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

// Note: Switching from Gemini to Puter.js for AI capabilities
// Puter.js provides a unified interface for multiple AI models (GPT-4o, Claude, etc.)

// متغير لتتبع حالة الـ AI
let isAIWorking = true;

// Safe local storage access for SSR
const getLocalStorageItem = (key: string) => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const setLocalStorageItem = (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

const removeLocalStorageItem = (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

// isAIWorking is used for internal state tracking even if not exported
if (typeof window !== 'undefined') {
  const savedStatus = getLocalStorageItem('gemini_api_status');
  if (savedStatus === 'working') {
    isAIWorking = true;
  } else if (savedStatus === 'quota_exceeded' || savedStatus === 'error') {
    isAIWorking = false;
  } else {
    isAIWorking = true;
  }
}

export interface ChatChunk {
  id: string;
  content: string;
  author?: string;
  timestamp?: string;
}

export type AiAssistantMode = 'group_rag' | 'cs_assistant' | 'student_agent';

export interface AiChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

const getAssistantPersonaName = (locale?: string): string => {
  return locale?.toLowerCase().startsWith('ar') ? 'زين' : 'ZANE';
};

type GeneratedQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  type: 'multiple-choice' | 'true-false';
};

type GeneratedQuiz = {
  title: string;
  questions: GeneratedQuizQuestion[];
};

type SummarizeChatAnalysis = {
  summary: string;
  important_messages?: {
    id?: string;
    content: string;
    sender_name: string;
    context?: string;
  }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGeneratedQuiz = (value: unknown): value is GeneratedQuiz => {
  if (!isRecord(value)) return false;
  if (typeof value.title !== 'string') return false;
  if (!Array.isArray(value.questions)) return false;
  return true;
};

export class AiAssistant {
  private chatChunks: ChatChunk[] = [];

  private buildChatHistoryContext(history?: AiChatHistoryTurn[], maxTurns: number = 20) {
    const safeHistory = (history || [])
      .filter(t => t?.content && t.content.trim())
      .slice(-maxTurns);

    if (safeHistory.length === 0) return '';

    const formatted = safeHistory
      .map(t => (t.role === 'user' ? `المستخدم: ${t.content}` : `المساعد: ${t.content}`))
      .join('\n');

    return `\n\nسياق المحادثة السابقة (للاستمرارية فقط):\n${formatted}`;
  }

  private async generateStudentAgentResponse(
    query: string,
    options?: {
      chatHistory?: AiChatHistoryTurn[];
      platformContext?: string;
      model?: string;
    },
  ): Promise<string> {
    const historyContext = this.buildChatHistoryContext(options?.chatHistory);
    const platformContext = String(options?.platformContext ?? '').trim();

    if (!platformContext) {
      return "لا يمكنني الإجابة من المنصة بدون تحديد بيانات كافية (مثل المادة/المستوى/الترم).";
    }

    const prompt = `أنت مساعد طلابي داخل منصة مسار X.

مهمتك: الإجابة فقط من بيانات المنصة المرفقة في قسم (سياق المنصة). ممنوع استخدام معلومات عامة أو معرفة خارجية.

قواعد صارمة:
1) أجب فقط اعتماداً على (سياق المنصة).
2) إذا كان السياق غير كافٍ أو لا يحتوي نتائج مرتبطة بالسؤال: قل بوضوح أنك لا تستطيع الإجابة من المنصة، واطلب من المستخدم اختيار المادة/المستوى/الترم.
3) لا تخترع روابط أو أسماء أو مواعيد.
4) عندما تذكر عنصر من المنصة، اذكر عنوانه كما هو.

سياق المنصة:
${platformContext}

سؤال المستخدم: ${query}${historyContext}`;

    if (isPuterCircuitOpen()) return getPuterUnavailableMessage();
    const puter = await getPuterClient();
    await warmupPuterClient();
    assertPuterSignedIn(puter);
    const model = await resolvePuterModel(puter, options?.model || 'gpt-5-nano');
    try {
      const response = await withPuterRetry(
        () =>
          puter.ai.chat(prompt, {
            model,
            stream: false,
          }),
        { maxAttempts: 3, baseDelayMs: 500 },
      );
      return await extractPuterChatText(response);
    } catch (error) {
      notePuterTransportFailure(error);
      if (isPuterCircuitOpen() && isPuterTransportError(error)) return getPuterUnavailableMessage();
      throw error;
    }
  }

  // Parse chat export text
  parseChatExport(text: string): ChatChunk[] {
    const chunks: ChatChunk[] = [];

    // Handle different data formats
    if (text.includes('**1.') && text.includes('**2.')) {
      // This appears to be a structured summary format, split by numbered sections
      const sections = text.split(/\*\*\d+\./).filter(section => section.trim());
      let chunkIndex = 0;

      for (const section of sections) {
        if (section.trim()) {
          chunks.push({
            id: `chunk_${chunkIndex++}`,
            content: section.trim(),
            timestamp: new Date().toISOString(), // Use current time for imported data
            author: 'Summary'
          });
        }
      }
    } else {
      // Standard chat export parsing
      const lines = text.split('\n');
      let currentMessage = '';
      let currentTimestamp = '';
      let currentAuthor = '';

      for (const line of lines) {
        // Chat export format: [12/17/25, 10:30:45 AM] Author: Message
        const timestampMatch = line.match(/^\[([^\]]+)\]/);

        if (timestampMatch) {
          // Save previous message if exists
          if (currentMessage.trim()) {
            chunks.push({
              id: `chunk_${chunks.length}`,
              content: currentMessage.trim(),
              timestamp: currentTimestamp,
              author: currentAuthor
            });
          }

          // Start new message
          const messagePart = line.replace(timestampMatch[0], '').trim();
          const colonIndex = messagePart.indexOf(':');

          if (colonIndex !== -1) {
            currentAuthor = messagePart.substring(0, colonIndex).trim();
            currentMessage = messagePart.substring(colonIndex + 1).trim();
          } else {
            currentAuthor = 'System';
            currentMessage = messagePart;
          }

          currentTimestamp = timestampMatch[1];
        } else if (line.trim()) {
          // Continuation of previous message
          currentMessage += '\n' + line;
        }
      }

      // Save last message
      if (currentMessage.trim()) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          content: currentMessage.trim(),
          timestamp: currentTimestamp,
          author: currentAuthor
        });
      }
    }

    this.chatChunks = chunks;
    return chunks;
  }

  // Search for relevant chunks based on query
  searchRelevantChunks(query: string, maxResults: number = 5): ChatChunk[] {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const scoredChunks = this.chatChunks
      // فلترة أولية: استبعاد الرسائل المحذوفة، النظام، النقط، الرسائل الهزلية أو القصيرة جداً
      .filter(chunk => {
        const c = chunk.content.trim();

        if (!c || c === '.' || c.length < 6) return false;
        if (/this message was deleted/i.test(c)) return false;
        if (chunk.author === 'System') return false;
        if (/^(اه|ايوه|تمام|نعم|طيب|لا)$/i.test(c)) return false; // ردود سريعة بلا معنى
        if (/^<Media omitted>/i.test(c)) return false;

        return true;
      })
      .map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        const authorLower = chunk.author?.toLowerCase() || '';

        // Simple scoring based on keyword matches
        let score = 0;

        // Exact phrase match gets highest score
        if (contentLower.includes(queryLower)) {
          score += 10;
        }

        // Individual word matches
        const queryWords = queryLower.split(/\s+/);
        for (const word of queryWords) {
          if (word.length > 1) { // Allow 2+ letter words for Arabic
            // Check for exact word matches and partial matches
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i'); // Word boundaries
            if (wordRegex.test(contentLower)) {
              score += 4; // Higher score for word boundary matches
            } else if (contentLower.includes(word)) {
              score += 2; // Lower score for partial matches
            }
            if (authorLower.includes(word)) {
              score += 2;
            }
          }
        }

        // Additional scoring for Arabic-specific patterns
        if (queryLower.includes('متى') && contentLower.includes('موعد')) score += 3;
        if (queryLower.includes('كيف') && contentLower.includes('طريقة')) score += 3;
        if (queryLower.includes('ما') && contentLower.includes('معلومات')) score += 3;

        // Recent messages get slight boost (if timestamp available)
        if (chunk.timestamp) {
          score += 0.1;
        }

        return { chunk, score };
      });

    // Sort by score and return top results
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.chunk);
  }

  // Generate AI response using Puter.js
  async generateResponse(
    query: string,
    _courseId?: string,
    options?: {
      mode?: AiAssistantMode;
      chatHistory?: AiChatHistoryTurn[];
      platformContext?: string;
      model?: string;
      locale?: string;
    }
  ): Promise<string> {
    const mode: AiAssistantMode = options?.mode || 'group_rag';
    const selectedModel = options?.model || 'gpt-5-nano';
    const requiresPuterAuth = isClaudeLikeModel(selectedModel);
    const historyContext = this.buildChatHistoryContext(options?.chatHistory);
    const relevantChunks = mode === 'group_rag' ? this.searchRelevantChunks(query, 8) : [];
    const assistantPersonaName = getAssistantPersonaName(options?.locale);

    if (mode === 'group_rag' && relevantChunks.length === 0) {
      const totalMessages = this.getStats().totalMessages;
      return `لم أجد معلومات ذات صلة في محادثات المجموعة (${totalMessages} رسائل متاحة) للإجابة على سؤالك. يرجى:\n\n1. إعادة صياغة السؤال بطريقة مختلفة\n2. التأكد من أن المحادثات تحتوي على معلومات حول هذا الموضوع\n3. تحميل بيانات أكثر شمولاً إذا لزم الأمر.\n\n💡 أو بدّل لوضع "مساعد برمجي" من أعلى الصفحة للحصول على مساعدة عامة في البرمجة.`;
    }

    try {
      if (mode === 'cs_assistant') {
        const prompt = `أنت مساعد برمجي متخصص لطلاب كلية الحاسبات والمعلومات.\n\nمهمتك: شرح مفاهيم البرمجة وعلوم الحاسب، حل مسائل، تحليل خوارزميات، وتصحيح أخطاء الكود.\n\nإرشادات:
1) اسأل أسئلة توضيحية عند نقص المعلومات بدل التخمين.
2) قدّم خطوات واضحة، ثم مثال عملي صغير.
3) عند كتابة كود: اذكر اللغة وافتراضات الإدخال/الإخراج، وراعِ أفضل الممارسات.
4) عند شرح خوارزمية: اذكر الفكرة، التعقيد، وحالات الحافة.
5) إذا طلب المستخدم مساعدة في واجب/مشروع: ساعده على الفهم ولا تكتفي بالحل النهائي إن أمكن.

${BREVITY_INSTRUCTION}

${ZANE_UI_INSTRUCTION}

سؤال المستخدم: ${query}${historyContext}`;

        if (isPuterCircuitOpen()) return getPuterUnavailableMessage();
        const puter = await getPuterClient();
        await warmupPuterClient();
        if (!puter) return getPuterUnavailableMessage();
        if (requiresPuterAuth) assertPuterSignedIn(puter);
        const model = await resolvePuterModel(puter, selectedModel);
        try {
          const response = await withPuterRetry(
            () =>
              puter.ai.chat(prompt, {
                model,
                stream: false,
              }),
            { maxAttempts: 3, baseDelayMs: 500 },
          );
          const text = await extractPuterChatText(response);
          return sanitizeAssistantReply(query, text);
        } catch (error) {
          notePuterTransportFailure(error);
          if (isPuterCircuitOpen() && isPuterTransportError(error)) return getPuterUnavailableMessage();
          throw error;
        }
      }

      if (mode === 'student_agent') {
        return await this.generateStudentAgentResponse(query, {
          chatHistory: options?.chatHistory,
          platformContext: options?.platformContext,
        });
      }

      const context = relevantChunks
        .map(chunk => `[${chunk.timestamp || 'Unknown time'}] ${chunk.author || 'Unknown'}: ${chunk.content}`)
        .join('\n\n');

      const prompt = `أنت ${assistantPersonaName}، مساعد ذكي متطور (Nindroid) متخصص في المحتوى التعليمي الجامعي. مهمتك هي الإجابة على أسئلة الطلاب بناءً على محادثات مجموعة واتساب جامعية باللغة العربية. تمتاز بشخصية هادئة، ذكية، ومخلصة.

السياق من محادثات المجموعة:
${context}

سؤال المستخدم: ${query}${historyContext}

تعليمات هامة جداً (يجب الالتزام بها تماماً):
1. أجب فقط بناءً على المعلومات المتاحة في السياق أعلاه
2. إذا لم يكن السؤال مرتبط بالمحادثات أو لا توجد معلومات كافية، قل: "عذراً، لا أجد معلومات كافية في المحادثات المتاحة لهذا السؤال"
3. لا تخترع معلومات أو تفترض أي شيء ليس موجود في السياق
4. ركز على المعلومات الأكاديمية والجامعية فقط (امتحانات، مواد، درجات، مواعيد، إلخ)
5. كن دقيقاً ومباشراً في الإجابات - خاصة للمواعيد والتفاصيل
6. أشر إلى المصدر عند الإمكان (مثل: "حسب ما ذكره [الاسم]")
7. تجاهل أي محتوى غير تعليمي أو هزلي في السياق
8. استخدم لغة عربية فصحى واضحة ومهنية

${BREVITY_INSTRUCTION}

${ZANE_UI_INSTRUCTION}`;

      // Use Puter.js AI Chat
      if (isPuterCircuitOpen()) return getPuterUnavailableMessage();
      const puter = await getPuterClient();
      await warmupPuterClient();
      if (!puter) return getPuterUnavailableMessage();
      if (requiresPuterAuth) assertPuterSignedIn(puter);
      const model = await resolvePuterModel(puter, selectedModel);
      try {
        const response = await withPuterRetry(
          () =>
            puter.ai.chat(prompt, {
              model,
              stream: false,
            }),
          { maxAttempts: 3, baseDelayMs: 500 },
        );
        const text = await extractPuterChatText(response);
        return sanitizeAssistantReply(query, text);
      } catch (error) {
        notePuterTransportFailure(error);
        if (isPuterCircuitOpen() && isPuterTransportError(error)) return getPuterUnavailableMessage();
        throw error;
      }

    } catch (error: unknown) {
      const context = relevantChunks
        .slice(0, 3)
        .map(chunk => `${chunk.author || 'مستخدم'}: ${chunk.content}`)
        .join('\n\n');

      // Log non-transport errors
      if (!isPuterTransportError(error) && !isPuterAuthError(error)) {
        logger.error('Puter AI error', error, { mode });
      }

      // Try server-side fallback if Puter failed
      if (isPuterTransportError(error)) {
        const fallbackResponse = await tryServerSideFallback(query, mode);
        if (fallbackResponse) {
          return fallbackResponse;
        }
      }

      if (mode === 'cs_assistant') {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('not signed in')) {
          return formatPuterNeedsLoginMessage(isClaudeLikeModel(selectedModel) ? selectedModel : undefined);
        }
        return `⚠️ مشكلة في خدمة الذكاء الاصطناعي (Puter) حالياً.\n\n💡 جرّب إعادة تحميل الصفحة أو المحاولة مرة أخرى لاحقاً.`;
      }
      return `⚠️ مشكلة في خدمة الذكاء الاصطناعي (Puter) حالياً.\n\nبناءً على المحادثات المتاحة، إليك المعلومات ذات الصلة:\n\n${context}\n\n💡 جرب إعادة تحميل الصفحة أو المحاولة مرة أخرى لاحقاً.`;
    }
  }

  // Get all chunks
  getAllChunks(): ChatChunk[] {
    return this.chatChunks;
  }

  // Get random chunks for quiz generation
  getRandomChunks(count: number = 5): ChatChunk[] {
    if (this.chatChunks.length === 0) return [];
    const shuffled = [...this.chatChunks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Clear all data
  clearData(): void {
    this.chatChunks = [];
  }

  // Get statistics
  getStats() {
    return {
      totalChunks: this.chatChunks.length,
      totalMessages: this.chatChunks.length,
      authors: [...new Set(this.chatChunks.map(c => c.author).filter(Boolean))].length
    };
  }

  // Check Puter AI status
  getPuterStatus() {
    if (typeof window === 'undefined') {
      return {
        isAIWorking,
        isSignedIn: false,
        status: 'puter_js',
      };
    }

    // Prefer SDK truth when possible to avoid UI thinking we're signed in while SDK isn't.
    let sdkSignedIn = false;
    try {
      const client = cachedPuterClient;
      sdkSignedIn = Boolean(client?.auth?.isSignedIn?.());
    } catch {
      sdkSignedIn = false;
    }

    const explicitSignedIn =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('puter_signed_in') === '1';

    return {
      isAIWorking,
      isSignedIn: sdkSignedIn || explicitSignedIn,
      status: 'puter_js',
    };
  }

  // Force re-enable AI (useful after quota reset)
  async forceReEnableAI(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Test the Edge Function instead of direct API
      const { supabase } = await import('./supabase');

      const { error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          query: 'test',
          relevantChunks: [{ content: 'test', author: 'system' }],
          userId: null
        }
      });

      if (error) {
        setLocalStorageItem('gemini_api_status', 'error');
        return false;
      }

      isAIWorking = true;
      setLocalStorageItem('gemini_api_status', 'working');
      removeLocalStorageItem('gemini_quota_error');
      setLocalStorageItem('gemini_last_test', Date.now().toString());
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        setLocalStorageItem('gemini_quota_error', new Date().toISOString());
        setLocalStorageItem('gemini_api_status', 'quota_exceeded');
      } else {
        setLocalStorageItem('gemini_api_status', 'error');
      }

      return false;
    }
  }

  async loadAllData(): Promise<void> {
    const filesToLoad = [
      'https://raw.githubusercontent.com/kali-upper/whatsapp-group/refs/heads/main/data.txt'
    ];

    let totalLoaded = 0;

    for (const fileUrl of filesToLoad) {
      try {
        const response = await fetch(fileUrl);

        if (!response.ok) {
          continue; // Skip this file and try next
        }

        const text = await response.text();
        const chunks = this.parseChatExport(text);
        totalLoaded += chunks.length;
      } catch {
        // ignore
      }
    }

    // Also try to load local data.txt if available (for development)
    try {
      const localResponse = await fetch('/data.txt');
      if (localResponse.ok) {
        const localText = await localResponse.text();
        const localChunks = this.parseChatExport(localText);
        totalLoaded += localChunks.length;
      }
    } catch {
      // ignore
    }

    if (totalLoaded < 10) {
      // Removed console warning
    }
  }

  // Load data from a local file (for manual upload)
  async loadFromText(text: string): Promise<void> {
    this.parseChatExport(text);
  }

  // Legacy function for backward compatibility
  async loadSampleData(): Promise<void> {
    return this.loadAllData();
  }

  // Method to reinitialize Gemini API status (for Edge Function system)
  async reinitializeGemini(): Promise<void> {
    try {
      // Clear any cached API key status
      removeLocalStorageItem('gemini_api_status');
      removeLocalStorageItem('gemini_quota_error');
      removeLocalStorageItem('gemini_last_test');

      // Reset to default state
      isAIWorking = true;
      setLocalStorageItem('gemini_api_status', 'working');
    } catch {
      isAIWorking = false;
    }
  }

  // Generate Quiz from text using Puter.js
  async generateQuiz(text: string): Promise<GeneratedQuiz> {
    // Construct the prompt
    const prompt = `
      Create a quiz with exactly 5 questions based on the following text.
      Mix between "multiple-choice" and "true-false" questions.
      The content is likely in Arabic, so generate the questions and options in Arabic.
      
      Return the result as a valid JSON object with this structure:
      {
        "title": "Suggested Quiz Title",
        "questions": [
          {
            "question": "Question text",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"], // For true-false, use ["صح", "خطأ"]
            "correctAnswer": 0, // Index of the correct option
            "explanation": "Why this answer is correct",
            "type": "multiple-choice" // or "true-false"
          }
        ]
      }

      Text to analyze:
      ${text}
    `;

    try {
      // Use Puter.js AI Chat for quiz generation
      const puter = await getPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const response = await puter.ai.chat(prompt, { 
        model: 'gpt-4o',
        stream: false
      });
      let jsonStr = String(response);

      // Clean up markdown if present
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

      // Find the first '{' and last '}' to ensure we only parse the JSON object
      const firstOpenBrace = jsonStr.indexOf('{');
      const lastCloseBrace = jsonStr.lastIndexOf('}');

      if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
        jsonStr = jsonStr.substring(firstOpenBrace, lastCloseBrace + 1);
      }

      const parsed: unknown = JSON.parse(jsonStr);
      if (!isGeneratedQuiz(parsed)) {
        throw new Error('Invalid quiz JSON format');
      }
      return parsed;
    } catch (error) {
      void error;
      throw error;
    }
  }

  // Summarize Chat using Puter.js
  async summarizeChat(chatId: string): Promise<SummarizeChatAnalysis> {
    try {
      // 1. Fetch chat messages from Supabase
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          sender:auth.users!messages_sender_id_fkey(id, email, raw_user_meta_data)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (messagesError) throw messagesError;

      const messages = (data as unknown as MessageWithSender[]) || [];

      if (!messages || messages.length === 0) {
        throw new Error('No messages to summarize');
      }

      // Reverse to chronological order
      const chronologicalMessages = messages.reverse();

      // 2. Prepare conversation text
      const conversationText = chronologicalMessages
        .map(msg => {
          const sender = msg.sender;
          const meta = sender?.raw_user_meta_data;
          const senderMeta = isRecord(meta) ? meta : null;
          const displayName = senderMeta && typeof senderMeta.display_name === 'string' ? senderMeta.display_name : undefined;
          const name = senderMeta && typeof senderMeta.name === 'string' ? senderMeta.name : undefined;
          const senderName = displayName || name || sender?.email?.split('@')[0] || 'مستخدم';
          return `${senderName}: ${msg.content}`;
        })
        .join('\n');

      // 3. Construct the prompt
      const prompt = `
      قم بتحليل المحادثة التالية وأعد:

      1. ملخصاً موجزاً للمحادثة باللغة العربية (لا يتجاوز 200 كلمة)
      2. تحديد الرسائل المهمة مع السياق الكامل لكل رسالة مهمة

      المحادثة:
      ${conversationText}

      يرجى تقديم النتيجة بتنسيق JSON بالشكل التالي:
      {
        "summary": "الملخص هنا",
        "important_messages": [
          {
            "id": "message_id", // سيتم ربطه لاحقاً
            "content": "محتوى الرسالة",
            "sender_name": "اسم المرسل",
            "context": "السياق المحيط بالرسالة المهمة"
          }
        ]
      }

      معايير تحديد الرسائل المهمة:
      - الرسائل التي تحتوي على قرارات أو اتفاقيات
      - الرسائل التي تحتوي على معلومات مهمة أو حقائق
      - الرسائل التي تحتوي على طلبات أو وعود
      - الرسائل التي تحتوي على أسئلة مهمة أو إجابات حاسمة
      - الرسائل التي تظهر تغييراً في الرأي أو التوجه
      `;

      // 4. Call Puter.js
      const puter = await getPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const response = await puter.ai.chat(prompt, { 
        model: 'gpt-4o',
        stream: false
      });
      let jsonStr = String(response);

      // Clean up markdown
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstOpenBrace = jsonStr.indexOf('{');
      const lastCloseBrace = jsonStr.lastIndexOf('}');
      if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
        jsonStr = jsonStr.substring(firstOpenBrace, lastCloseBrace + 1);
      }

      const aiAnalysis = JSON.parse(jsonStr) as unknown as SummarizeChatAnalysis;

      // 5. Match important messages to original IDs
      const importantMessages = aiAnalysis.important_messages?.map((msg) => {
        const originalMessage = chronologicalMessages.find(m => {
          const sender = m.sender;
          const meta = sender?.raw_user_meta_data;
          const senderMeta = isRecord(meta) ? meta : null;
          const displayName = senderMeta && typeof senderMeta.display_name === 'string' ? senderMeta.display_name : undefined;
          const name = senderMeta && typeof senderMeta.name === 'string' ? senderMeta.name : undefined;
          const senderName = displayName || name || sender?.email?.split('@')[0] || 'مستخدم';
          return m.content.includes(msg.content.substring(0, 20)) && senderName === msg.sender_name;
        });

        if (originalMessage) {
          return {
            id: originalMessage.id,
            content: originalMessage.content,
            sender_id: originalMessage.sender_id,
            sender_name: msg.sender_name,
            created_at: originalMessage.created_at,
            context: msg.context || originalMessage.content
          };
        }
        return null;
      }).filter(Boolean) || [];

      // 6. Save to Supabase
      const lastMessageId = chronologicalMessages[chronologicalMessages.length - 1]?.id;

      const { error: summaryError } = await supabase
        .from('ai_summaries')
        .insert({
          chat_id: chatId,
          summary_content: aiAnalysis.summary,
          important_messages: importantMessages,
          last_message_id: lastMessageId,
        });

      if (summaryError) throw summaryError;

      return aiAnalysis;

    } catch (error) {
      void error;
      throw error;
    }
  }

  // Summarize loaded data (from text file)
  async summarizeLoadedData(): Promise<SummarizeChatAnalysis> {
    const chunks = this.chatChunks;
    if (!chunks || chunks.length === 0) {
      throw new Error('No data loaded to summarize');
    }

    // Limit to last 100 chunks to avoid token limits
    const recentChunks = chunks.slice(-100);

    const conversationText = recentChunks
      .map(chunk => `${chunk.author || 'Unknown'}: ${chunk.content}`)
      .join('\n');

    const prompt = `
      قم بتحليل المحادثة التالية وأعد:

      1. ملخصاً موجزاً للمحادثة باللغة العربية (لا يتجاوز 200 كلمة)
      2. تحديد الرسائل المهمة مع السياق الكامل لكل رسالة مهمة

      المحادثة:
      ${conversationText}

      يرجى تقديم النتيجة بتنسيق JSON بالشكل التالي:
      {
        "summary": "الملخص هنا",
        "important_messages": [
          {
            "id": "chunk_id",
            "content": "محتوى الرسالة",
            "sender_name": "اسم المرسل",
            "context": "السياق المحيط بالرسالة المهمة"
          }
        ]
      }

       معايير تحديد الرسائل المهمة:
      - الرسائل التي تحتوي على قرارات أو اتفاقيات
      - الرسائل التي تحتوي على معلومات مهمة أو حقائق
      - الرسائل التي تحتوي على طلبات أو وعود
      - الرسائل التي تحتوي على أسئلة مهمة أو إجابات حاسمة
      - الرسائل التي تظهر تغييراً في الرأي أو التوجه
    `;

    try {
      const puter = await getPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const response = await puter.ai.chat(prompt, { 
        model: 'gpt-4o',
        stream: false
      });
      let jsonStr = String(response);

      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstOpenBrace = jsonStr.indexOf('{');
      const lastCloseBrace = jsonStr.lastIndexOf('}');
      if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
        jsonStr = jsonStr.substring(firstOpenBrace, lastCloseBrace + 1);
      }

      const aiAnalysis = JSON.parse(jsonStr);
      return aiAnalysis;
    } catch (error) {
      void error;
      throw error;
    }
  }
  async summarizeCurrentChat(messages: { role: string; content: string }[]): Promise<SummarizeChatAnalysis> {
    if (!messages || messages.length === 0) {
      throw new Error('No messages to summarize');
    }

    const recentMessages = messages.slice(-50);
    const conversationText = recentMessages
      .map(msg => `${msg.role === 'user' ? 'المستخدم' : 'المساعد'}: ${msg.content}`)
      .join('\n');

    const prompt = `
      قم بتحليل المحادثة الحالية بين المستخدم والمساعد البرمجي وأعد ملخصاً تقنياً مركزاً.
      
      المحادثة:
      ${conversationText}

      يرجى تقديم النتيجة بتنسيق JSON:
      {
        "summary": "ملخص تقني للمواضيع البرمجية التي تم نقاشها والحلول المقترحة",
        "important_messages": []
      }
    `;

    try {
      const puter = await getPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const response = await puter.ai.chat(prompt, { 
        model: 'gpt-4o',
        stream: false
      });
      let jsonStr = String(response);
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstOpenBrace = jsonStr.indexOf('{');
      const lastCloseBrace = jsonStr.lastIndexOf('}');
      if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
        jsonStr = jsonStr.substring(firstOpenBrace, lastCloseBrace + 1);
      }
      return JSON.parse(jsonStr);
    } catch (error) {
      throw error;
    }
  }

  async summarizeAcademicContext(subject: string, context: string): Promise<SummarizeChatAnalysis> {
    const prompt = `
      أنت خبير أكاديمي. قم بتلخيص المحتوى الدراسي التالي لمادة (${subject}) بشكل منظم ومنهجي.
      
      المحتوى:
      ${context}

      يرجى تقديم النتيجة بتنسيق JSON:
      {
        "summary": "ملخص أكاديمي شامل يغطي أهم المفاهيم والقوانين أو النقاط الدراسية",
        "important_messages": []
      }
    `;

    try {
      const puter = await getPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const response = await puter.ai.chat(prompt, { 
        model: 'gpt-4o',
        stream: false
      });
      let jsonStr = String(response);
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstOpenBrace = jsonStr.indexOf('{');
      const lastCloseBrace = jsonStr.lastIndexOf('}');
      if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
        jsonStr = jsonStr.substring(firstOpenBrace, lastCloseBrace + 1);
      }
      return JSON.parse(jsonStr);
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const aiAssistant = new AiAssistant();
