/**
 * Mobile AI client - a thin wrapper over the shared package's
 * sendAiMessage / streamAiMessage (contracts/ai-boundary.md is the
 * chokepoint contract; the app never talks to an AI provider directly).
 *
 * Native wrinkle: the shared client's default edgeFunctionUrl is
 * "/api/ai-chat" (the web app's Next.js proxy). There is no Next.js
 * server on native, so on mobile we resolve the ABSOLUTE Supabase Edge
 * Function URL instead: `${SUPABASE_URL}/functions/v1/ai-chat`. The
 * request/response wire shapes stay exactly the shared contract's
 * (AiRequest / AiResponse / AiResponseDelta); streamAiMessage already
 * sends `Accept: text/event-stream` for the streaming variant.
 *
 * Known backend gap (tracked by tasks.md T054a): the ai-chat Edge
 * Function authenticates the caller via the `Authorization` bearer
 * header, which the web's Next.js proxy injects from the session
 * cookie. The shared client does not (yet) attach an Authorization
 * header itself, so until the shared client grows an authToken option
 * this wrapper surfaces the Edge Function's 401 as a normal chat error
 * with a retry affordance - no secret ever travels in a body or header
 * from here (contract: "What the apps are NOT allowed to do").
 */
import Constants from "expo-constants";

import {
  sendAiMessage,
  streamAiMessage,
  type AiRequest,
  type AiResponse,
  type AiResponseDelta,
} from "masarx-shared/ai";

import { SUPABASE_URL, isSupabaseConfigured } from "./supabase";
import { uuid4 } from "./uuid";

export type { AiRequest, AiResponse, AiResponseDelta };

/** Absolute Edge Function URL for native (the shared default is a web proxy path). */
export const AI_EDGE_FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/ai-chat`
  : "";

export function isAiConfigured(): boolean {
  return isSupabaseConfigured && AI_EDGE_FUNCTION_URL.length > 0;
}

/** Build a contract-shaped AiRequest with the mobile device context. */
export function createAiRequest(userMessage: string, language: "ar" | "en"): AiRequest {
  return {
    conversationId: uuid4(),
    userMessage,
    context: {
      language,
      appVersion: Constants.expoConfig?.version ?? "0.0.0",
      deviceClass: "mobile",
    },
  };
}

/** Non-streaming request: one round-trip, full AiResponse. */
export async function sendAiMessageMobile(
  request: AiRequest,
  options: { signal?: AbortSignal } = {},
): Promise<AiResponse> {
  return sendAiMessage(request, { ...options, edgeFunctionUrl: AI_EDGE_FUNCTION_URL });
}

/**
 * Streaming request: yields AiResponseDelta chunks as they arrive. The
 * terminal delta carries `done: true`. Cancellation propagates via the
 * AbortSignal (e.g. when the user leaves the chat screen).
 */
export function streamAiMessageMobile(
  request: AiRequest,
  options: { signal?: AbortSignal } = {},
): AsyncIterable<AiResponseDelta> {
  return streamAiMessage(request, { ...options, edgeFunctionUrl: AI_EDGE_FUNCTION_URL });
}