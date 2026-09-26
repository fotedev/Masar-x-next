/**
 * Spec 017 — Provider-agnostic adapter contract (Commit 3a).
 *
 * Shared types for `AIProvider` adapters. This file owns the
 * `NormalizedError` taxonomy so the policy (3b) never branches on opaque
 * SDK shapes. Puter-specific mapping lives in `./errors`.
 */

/** Request mode — mirrors `AiAssistantMode` in `../assistant`. */
export type ChatMode = 'group_rag' | 'cs_assistant' | 'student_agent';

/**
 * Normalized error kinds surfaced by adapters.
 *
 * - `Cancelled` — `AbortSignal` fired (AC14; never ticks the breaker).
 * - `QuotaExceeded` — Puter 402 / insufficient_funds (AC21 gate).
 * - `Unavailable` — transport-classified throw before first-token
 *   (ticks the breaker; the policy may fall back).
 * - `Fatal` — model-not-available + anything unclassified (no retry helps).
 * - `AuthRequired` — Puter not signed in (premium-model gate).
 * - `RateLimited` — never produced by Puter (spec §3.4 mock-only kind so
 *   the policy can exhaustively switch over all kinds).
 */
export type NormalizedErrorKind =
  | 'Cancelled'
  | 'QuotaExceeded'
  | 'Unavailable'
  | 'Fatal'
  | 'AuthRequired'
  | 'RateLimited';

/** `Error` + machine-readable `kind` + originating provider id. */
export type NormalizedError = Error & {
  kind: NormalizedErrorKind;
  providerId: string;
  cause?: unknown;
};

/** Streaming chat request (spec §3.3 — serves chat UI). */
export interface ChatRequest {
  prompt: string;
  mode: ChatMode;
  model?: string;
  signal: AbortSignal;
  onDelta: (fullSoFar: string) => void;
  onFirstToken: () => void;
}

/** One-shot completion request (spec §3.3 — serves summarize / generateQuiz). */
export interface CompletionRequest {
  prompt: string;
  mode: ChatMode;
  model?: string;
  signal: AbortSignal;
  /** Currently a no-op for Puter (the SDK returns a single string-or-object). */
  onPartial?: (partialSoFar: string) => void;
}

/** One-shot completion result. */
export interface AdapterResult {
  text: string;
  parsed?: unknown;
}

/** Provider adapter contract implemented by `PuterProvider` (3a). The policy (3b) consumes this. */
export interface AIProvider {
  readonly id: string;
  available(): Promise<boolean>;
  stream(req: ChatRequest): Promise<string>;
  complete(req: CompletionRequest): Promise<AdapterResult>;
}
