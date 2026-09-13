/**
 * Public entry for the ZANE assistant (spec 004).
 *
 * The implementation lives under `src/lib/ai/` (assistant, puter-client,
 * circuit-breaker, errors, prompts, sanitize). Import from this path —
 * not from the internals — so the module boundaries stay swappable.
 */

export { aiAssistant, AiAssistant } from './ai/assistant';
export type {
  AiAssistantMode,
  AiChatHistoryTurn,
} from './ai/assistant';
