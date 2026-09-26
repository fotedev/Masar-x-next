/**
 * Spec 017 — AI provider abstraction: type contracts.
 *
 * Two-method shape (stream + complete) so a single adapter covers both the
 * chat streaming call sites and the one-shot completion sites (summarize,
 * generateQuiz). The policy engine (policy.ts) reads only this file; adapters
 * implement these shapes and never import each other.
 *
 * Five-name error taxonomy is fixed:
 *   QuotaExceeded | RateLimited | Unavailable | Fatal | Cancelled
 * `Cancelled` is never a failure — see spec §3.4.
 */

/**
 * The three assistant personas. Mirrors `assistant.ts#AiAssistantMode` —
 * duplicated here (not imported) so `types.ts` has no dependency on
 * `assistant.ts`. Commit 3 will align the two definitions.
 */
export type AiAssistantMode = 'cs_assistant' | 'student_agent' | 'group_rag';

/** Single text delta emitted by a streaming adapter. */
export interface ChatChunk {
  /** Plain text delta. Empty strings are not emitted by adapters (filter upstream). */
  text: string;
}

/** Discriminator names are locked by spec §3.4. */
export type NormalizedErrorKind =
  | 'QuotaExceeded'
  | 'RateLimited'
  | 'Unavailable'
  | 'Fatal'
  | 'Cancelled';

/**
 * Errors surfaced by adapters are normalized to this shape. Adapters MUST
 * throw `NormalizedError` (or have the policy wrap the original via
 * `classifyPuterError`). The taxonomy names are the only ones callers
 * should branch on — `cause` is for logs only.
 */
export interface NormalizedError extends Error {
  /** Discriminator; "Cancelled" is never a failure. */
  kind: NormalizedErrorKind;
  /** Underlying cause, for logger.warn only. */
  cause?: unknown;
  /** Provider id, for telemetry. */
  providerId: string;
}

/** Type guard: `e is NormalizedError`. */
export const isNormalizedError = (e: unknown): e is NormalizedError => {
  if (!(e instanceof Error)) return false;
  const kind = (e as unknown as { kind?: unknown }).kind;
  if (typeof kind !== 'string') return false;
  return (
    kind === 'QuotaExceeded' ||
    kind === 'RateLimited' ||
    kind === 'Unavailable' ||
    kind === 'Fatal' ||
    kind === 'Cancelled'
  );
};

/** Whether the policy should attempt the next provider on this kind. */
export const isFallbackEligible = (kind: NormalizedErrorKind): boolean =>
  kind === 'QuotaExceeded' || kind === 'RateLimited' || kind === 'Unavailable';

/**
 * Streaming call: chat-style deltas, with a first-token signal so the
 * policy can lock the provider (no further fallback after first token —
 * spec §3.5 rule 4).
 */
export interface ChatRequest {
  prompt: string;
  mode: AiAssistantMode;
  model?: string;
  signal: AbortSignal;
  /** Called on every text delta AFTER the first delta. */
  onDelta: (fullText: string) => void;
  /** Called exactly once, on first emitted chunk. Used by the policy to lock. */
  onFirstToken: () => void;
}

/**
 * One-shot completion: single JSON or string result. `onPartial` is optional —
 * some completion paths report partial JSON, most do not. If supplied, the
 * FIRST call to `onPartial` is the policy's "first token" signal.
 */
export interface CompletionRequest {
  prompt: string;
  mode: AiAssistantMode;
  model?: string;
  signal: AbortSignal;
  /** Optional streaming hint for completion providers. */
  onPartial?: (partialJson: string) => void;
}

/** Result of a completion call. `text` is always the raw output; `parsed`
 *  is the JSON-parsed object when the caller expects JSON. */
export interface AdapterResult {
  text: string;
  parsed?: unknown;
}

/**
 * Adapter contract. Every provider (Puter, Mock, future ones) implements
 * this. Adapters MUST NOT consult other providers; they MUST NOT decide
 * whether to fall back; they MUST NOT know the policy exists (spec §3.2).
 */
export interface AIProvider {
  readonly id: string;
  /** Streaming chat. Resolves to the final accumulated text on success. */
  stream(req: ChatRequest): Promise<string>;
  /** One-shot completion. Resolves to the final text/JSON on success. */
  complete(req: CompletionRequest): Promise<AdapterResult>;
  /** True if this provider is currently usable (signed-in, model loaded, etc.). */
  available(): Promise<boolean>;
}
