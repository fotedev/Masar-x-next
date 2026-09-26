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
 * Auth (spec 018 C4): the ai-chat Edge Function authenticates the
 * caller via the `Authorization` bearer header (`auth.getUser()`).
 * The web's Next.js proxy injects it from the session cookie; native
 * has no proxy, so the shared client's `authToken` option now carries
 * the Supabase session access token per call. No token (guest /
 * unconfigured) simply omits the header — the Edge Function's 401
 * surfaces as a normal retryable chat error. No secret ever travels in
 * a body or header from here (contract: "What the apps are NOT allowed
 * to do"). SSE streaming end-to-end remains a separate follow-up
 * (spec 004 T054a).
 */
import Constants from "expo-constants";

import {
  sendAiMessage,
  streamAiMessage,
  type AiRequest,
  type AiResponse,
  type AiResponseDelta,
} from "masarx-shared/ai";

import { SUPABASE_URL, getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { uuid4 } from "./uuid";

export type { AiRequest, AiResponse, AiResponseDelta };

/** Absolute Edge Function URL for native (the shared default is a web proxy path). */
export const AI_EDGE_FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/ai-chat`
  : "";

export function isAiConfigured(): boolean {
  return isSupabaseConfigured && AI_EDGE_FUNCTION_URL.length > 0;
}

/**
 * Resolve the current session's access token for the Edge Function's
 * Authorization check. Best-effort: unconfigured backend, missing
 * session, or storage failure all resolve to `undefined`, which makes
 * the shared client omit the header (same wire behavior as before
 * spec 018).
 */
async function getAuthToken(): Promise<string | undefined> {
  if (!isSupabaseConfigured) return undefined;
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.access_token ?? undefined;
  } catch {
    return undefined;
  }
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
  const authToken = await getAuthToken();
  return sendAiMessage(request, {
    ...options,
    edgeFunctionUrl: AI_EDGE_FUNCTION_URL,
    authToken,
  });
}

/**
 * Streaming request: yields AiResponseDelta chunks as they arrive. The
 * terminal delta carries `done: true`. Cancellation propagates via the
 * AbortSignal (e.g. when the user leaves the chat screen).
 */
export async function* streamAiMessageMobile(
  request: AiRequest,
  options: { signal?: AbortSignal } = {},
): AsyncIterable<AiResponseDelta> {
  const authToken = await getAuthToken();
  yield* streamAiMessage(request, {
    ...options,
    edgeFunctionUrl: AI_EDGE_FUNCTION_URL,
    authToken,
  });
}
