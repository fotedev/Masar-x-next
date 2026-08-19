/**
 * Type surface for the cross-platform AI client.
 *
 * Mirrors the contract in
 * `specs/004-multi-platform-expansion/contracts/ai-boundary.md`:
 * the apps call `sendAiMessage` (or `streamAiMessage`), the shared
 * package routes the call to the Supabase Edge Function, and the AI
 * provider key is read server-side by the Edge Function. The apps
 * never see the AI provider key.
 */

export interface AiRequest {
  conversationId: string;
  userMessage: string;
  /**
   * Client context, used for:
   *  - language preference (so the AI responds in the user's language)
   *  - app version (so the AI can refuse to answer on unsupported builds)
   *  - device class (so long responses can be marked as streamable for mobile)
   *
   * No PII, no auth tokens, no secrets.
   */
  context: {
    language: "ar" | "en";
    appVersion: string;
    deviceClass: "desktop" | "mobile" | "web";
  };
}

export interface AiResponse {
  /**
   * The full assistant message. Long responses are streamed; the
   * client may receive partial deltas via the streaming variant.
   */
  content: string;
  /**
   * Token usage, returned so the client can show "you have N tokens
   * left". No provider-specific data.
   */
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * One delta in a streaming AI response. The server pushes partial
 * deltas; the client accumulates them. The final delta has
 * `done: true` and the same `usage` shape as the non-streaming
 * response.
 */
export interface AiResponseDelta {
  delta: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
