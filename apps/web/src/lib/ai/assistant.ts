/**
 * The ZANE assistant client (spec 004): mode-driven responses over the
 * Puter.js SDK with a server-side fallback.
 *
 * Modes:
 *  - cs_assistant   — general CS/programming help (Puter, sanitized reply)
 *  - student_agent  — answers strictly from provided platform context
 *  - group_rag      — legacy WhatsApp-group RAG mode. The chunk-upload
 *    path was retired, so this mode answers with its canned "no data"
 *    message; it is kept because the UI still offers the mode.
 *
 * Implementation modules live beside this file (errors, circuit-breaker,
 * puter-client, prompts, sanitize). Import the singleton from
 * `@/lib/ai-assistant`, which is the stable public entry.
 */

import { logger } from '@/lib/logger';
import {
  asErrorMessage,
  formatPuterNeedsLoginMessage,
  isClaudeLikeModel,
  isPuterAuthError,
  isPuterInsufficientFundsError,
  isPuterModelNotAvailableError,
  isPuterTransportError,
} from './errors';
import {
  getPuterUnavailableMessage,
  isPuterCircuitOpen,
  notePuterTransportFailure,
  withPuterRetry,
  withTimeout,
} from './circuit-breaker';
import {
  assertPuterSignedIn,
  extractPuterChatText,
  extractPuterChunkText,
  getPuterClient,
  hasAsyncIterator,
  isPuterSdkSignedIn,
  isRecord,
  resetPuterClientCache,
  resolvePuterModel,
  warmupPuterClient,
} from './puter-client';
import type { PuterClientLike } from './puter-client';
import { sanitizeAssistantReply } from './sanitize';
import { consumeTextStream } from './stream-reader';
import { cannedMessagesFor } from './canned-messages';
import { BREVITY_INSTRUCTION, ZANE_UI_INSTRUCTION } from './prompts';

export type AiAssistantMode = 'group_rag' | 'cs_assistant' | 'student_agent';

// Spec 012: Puter 402 / insufficient_funds is a billing state, not an outage
// (no circuit breaker, no retry helps). Remember the depleted model so repeat
// sends with it return the canned message instantly instead of re-hitting the
// network. Cleared on any successful response; switching models naturally
// bypasses the gate because the comparison is per model.
let puterFundsDepletedModel: string | null = null;

const isPuterFundsDepletedForModel = (model?: string) => {
  if (puterFundsDepletedModel === null) return false;
  return (model || 'gpt-5.4-nano').toLowerCase() === puterFundsDepletedModel;
};

const clearPuterFundsDepleted = () => {
  puterFundsDepletedModel = null;
};

export interface AiChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

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

const isGeneratedQuiz = (value: unknown): value is GeneratedQuiz => {
  if (!isRecord(value)) return false;
  if (typeof value.title !== 'string') return false;
  if (!Array.isArray(value.questions)) return false;
  return true;
};

/**
 * Fallback: Call server-side AI endpoint when Puter is unavailable.
 * The route answers with a plain-text chunked stream (toTextStreamResponse),
 * so consume it incrementally — reading it as JSON can never succeed.
 */
const tryServerSideFallback = async (
  prompt: string,
  mode: AiAssistantMode = 'group_rag',
  onDelta?: (fullSoFar: string) => void,
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

    const text = await consumeTextStream(response, onDelta);
    return text || null;
  } catch (error) {
    console.warn('[AI Fallback] Error calling server endpoint:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

/** Legacy explicit-sign-in flag set by lib/puter on successful sign-in. */
const getExplicitSignedIn = (): boolean => {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('puter_signed_in') === '1'
    );
  } catch {
    return false;
  }
};

/**
 * Streamed chat call (spec 011): requests stream:true and reports the
 * accumulated text through onDelta after every chunk. The timeout bounds
 * setup + time-to-first-chunk; once text is flowing there is no overall cap.
 * A provider that ignores stream:true falls back to the full-response
 * extractor. A mid-stream failure returns the partial text when any arrived
 * (the user keeps what they saw) and only rethrows when nothing was
 * extracted, so pre-content failures keep their retry/fallback ladder.
 */
const streamPuterChat = async (
  puter: PuterClientLike,
  prompt: string,
  model: string,
  onDelta: ((fullSoFar: string) => void) | undefined,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<string> => {
  const response = await withTimeout(
    puter.ai.chat(prompt, { model, stream: true }),
    timeoutMs,
    timeoutMessage,
  );

  if (!hasAsyncIterator(response)) {
    return extractPuterChatText(response);
  }

  const iterator = response[Symbol.asyncIterator]();
  let full = '';
  try {
    const first = await withTimeout(iterator.next(), timeoutMs, timeoutMessage);
    if (!first.done) {
      const delta = extractPuterChunkText(first.value);
      if (delta) {
        full += delta;
        onDelta?.(full);
      }
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        const chunk = extractPuterChunkText(next.value);
        if (!chunk) continue;
        full += chunk;
        onDelta?.(full);
      }
    }
  } catch (error) {
    if (!full) throw error;
    logger.warn('Puter stream interrupted after partial text', {
      chars: full.length,
      error: asErrorMessage(error),
    });
  } finally {
    // Best-effort close so an interrupted iterator does not keep the
    // underlying connection alive.
    try {
      await iterator.return?.(undefined);
    } catch {
      // ignore
    }
  }
  return full;
};

export class AiAssistant {
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
      locale?: string;
      onDelta?: (fullSoFar: string) => void;
    },
  ): Promise<string> {
    const canned = cannedMessagesFor(options?.locale);
    const historyContext = this.buildChatHistoryContext(options?.chatHistory);
    const platformContext = String(options?.platformContext ?? '').trim();

    if (!platformContext) {
      return canned.noPlatformContext;
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

    if (isPuterCircuitOpen()) return getPuterUnavailableMessage(options?.locale);

    const executeWithPuter = async () => {
      const puter = await getPuterClient();
      await warmupPuterClient();
      if (!puter) throw new Error('Puter client not available');
      const selectedModel = options?.model || 'gpt-5.4-nano';
      if (isClaudeLikeModel(selectedModel)) assertPuterSignedIn(puter);
      const model = await resolvePuterModel(puter, selectedModel);

    try {
      return await withPuterRetry(
        () => streamPuterChat(
          puter,
          prompt,
          model,
          options?.onDelta,
          30000,
          `AI request timed out using model: ${model}`,
        ),
        {
          maxAttempts: 3,
          baseDelayMs: 800,
          onRetry: (err) => {
            if (isPuterTransportError(err)) {
              resetPuterClientCache();
            }
          }
        }
      );
    } catch (err) {
      if (isPuterModelNotAvailableError(err) && model !== 'gpt-5.4-nano') {
        return streamPuterChat(
          puter,
          prompt,
          'gpt-5.4-nano',
          options?.onDelta,
          30000,
          'Fallback AI request timed out',
        );
      }
      throw err;
    }
  };

    try {
      return await executeWithPuter();
    } catch (error) {
      notePuterTransportFailure(error);
      if (isPuterCircuitOpen() && isPuterTransportError(error)) return getPuterUnavailableMessage(options?.locale);
      throw error;
    }
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
      onDelta?: (fullSoFar: string) => void;
    }
  ): Promise<string> {
    const mode: AiAssistantMode = options?.mode || 'group_rag';
    const canned = cannedMessagesFor(options?.locale);
    const selectedModel = options?.model || 'gpt-5.4-nano';
    const historyContext = this.buildChatHistoryContext(options?.chatHistory);

    // group_rag has no chunk source anymore (the upload path was retired),
    // so it always answers with the canned message instead of reaching the SDK.
    if (mode === 'group_rag') {
      return canned.groupRagNoData;
    }

    // Spec 012: a depleted model short-circuits with the actionable canned
    // message — no Puter call, no error bubble.
    if (isPuterFundsDepletedForModel(selectedModel)) {
      return canned.insufficientFunds;
    }

    const executeWithPuter = async (prompt: string, model: string) => {
      if (isPuterCircuitOpen()) return null;

      const puter = await getPuterClient();
      await warmupPuterClient();
      if (!puter) return null;

      const resolvedModel = await resolvePuterModel(puter, model);
      const isPremium = isClaudeLikeModel(resolvedModel);

      const getAuthSnapshot = () => {
        let signedIn = false;
        try {
          signedIn = Boolean(puter.auth?.isSignedIn?.());
        } catch {
          signedIn = false;
        }
        return { signedIn };
      };

      if (isPremium) {
        // Late-binding auth check for premium models
        let signedIn = getAuthSnapshot().signedIn;

        if (!signedIn) {
          // Re-warmup specifically for auth state
          await warmupPuterClient();
          try {
            signedIn = Boolean(puter.auth?.isSignedIn?.());
          } catch {
            signedIn = false;
          }
        }

        if (!signedIn) {
          throw new Error('Puter not signed in');
        }
      }

      try {
        return await withPuterRetry(
          () => streamPuterChat(
            puter,
            prompt,
            resolvedModel,
            options?.onDelta,
            isPremium ? 25000 : 30000,
            `AI request timed out using model: ${resolvedModel}`,
          ),
          {
            maxAttempts: 3,
            baseDelayMs: 1000,
            onRetry: (err, attempt) => {
              console.warn(`[Puter] Retry attempt ${attempt} due to error:`, asErrorMessage(err));
              if (isPuterTransportError(err)) {
                resetPuterClientCache();
              }
            }
          }
        );
      } catch (err) {
        // Auto-fallback to GPT model for premium model failures
        if (isClaudeLikeModel(resolvedModel) && (isPuterTransportError(err) || asErrorMessage(err).includes('timed out'))) {
          console.warn(`[Puter] Auto-falling back from ${resolvedModel} to gpt-5.4-nano due to error:`, asErrorMessage(err));
          return streamPuterChat(
            puter,
            prompt,
            'gpt-5.4-nano',
            options?.onDelta,
            30000,
            'Fallback AI request timed out',
          );
        }
        if (isPuterModelNotAvailableError(err) && resolvedModel !== 'gpt-5.4-nano') {
          return streamPuterChat(
            puter,
            prompt,
            'gpt-5.4-nano',
            options?.onDelta,
            30000,
            'Fallback AI request timed out',
          );
        }
        throw err;
      }
    };

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

        const text = await executeWithPuter(prompt, selectedModel);
        if (text === null) return getPuterUnavailableMessage(options?.locale);

        clearPuterFundsDepleted();

        // onDelta reported the raw stream; the returned (persisted) message is
        // the sanitized one — useAiChat swaps it in at finalize.
        return sanitizeAssistantReply(query, text);
      }

      // student_agent (the remaining reachable mode)
      const studentReply = await this.generateStudentAgentResponse(query, {
        chatHistory: options?.chatHistory,
        platformContext: options?.platformContext,
        model: selectedModel,
        locale: options?.locale,
        onDelta: options?.onDelta
      });
      clearPuterFundsDepleted();
      return studentReply;

    } catch (error: unknown) {
      // Log all errors with appropriate levels
      if (isPuterTransportError(error)) {
        logger.warn('Puter transport error', {
          mode,
          selectedModel,
          circuitOpen: isPuterCircuitOpen(),
          error: asErrorMessage(error),
        });
      } else if (isPuterAuthError(error)) {
        logger.info('Puter auth error', {
          mode,
          selectedModel,
          error: asErrorMessage(error),
        });
      } else if (isPuterInsufficientFundsError(error)) {
        // Billing state, not an outage: remember the model, log a compact
        // reason (never the opaque {} of logger.error with a raw payload),
        // and return the actionable canned message below.
        puterFundsDepletedModel = selectedModel.toLowerCase();
        logger.warn('Puter funds depleted for model', {
          mode,
          selectedModel,
          reason: asErrorMessage(error),
        });
      } else {
        logger.error('Puter AI error', error, { mode, selectedModel });
      }

      // Try server-side fallback if Puter failed (also streamed)
      if (isPuterTransportError(error)) {
        const fallbackResponse = await tryServerSideFallback(query, mode, options?.onDelta);
        if (fallbackResponse) {
          return fallbackResponse;
        }
      }

      if (mode === 'cs_assistant') {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('not signed in')) {
          return formatPuterNeedsLoginMessage(
            isClaudeLikeModel(selectedModel) ? selectedModel : undefined,
            options?.locale,
          );
        }
        if (isPuterTransportError(error)) {
          const isClaudeModel = isClaudeLikeModel(selectedModel);
          if (isClaudeModel) {
            return canned.claudeFallback;
          }
          return canned.serviceUnavailable;
        }
        if (isPuterInsufficientFundsError(error)) {
          return canned.insufficientFunds;
        }
        return canned.genericError;
      }

      if (isPuterTransportError(error)) {
        const isClaudeModel = isClaudeLikeModel(selectedModel);
        if (isClaudeModel) {
          return canned.claudeFallbackShort;
        }
        return canned.serviceUnavailableShort;
      }

      if (isPuterInsufficientFundsError(error)) {
        return canned.insufficientFunds;
      }

      return canned.genericError;
    }
  }

  // Check Puter AI status
  getPuterStatus() {
    if (typeof window === 'undefined') {
      return {
        isAIWorking: true,
        isSignedIn: false,
        status: 'puter_js',
      };
    }

    return {
      isAIWorking: true,
      isSignedIn: isPuterSdkSignedIn() || getExplicitSignedIn(),
      status: 'puter_js',
    };
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
  }

  // Summarize loaded data (from text file)
  //
  // The chunk-upload path that fed this method was retired, so there is
  // never any data to summarize. Kept because the assistant page still
  // calls it for group_rag; the page's catch shows the same error toast
  // it always has.
  async summarizeLoadedData(): Promise<SummarizeChatAnalysis> {
    throw new Error('No data loaded to summarize');
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
  }
}

// Export singleton instance
export const aiAssistant = new AiAssistant();
