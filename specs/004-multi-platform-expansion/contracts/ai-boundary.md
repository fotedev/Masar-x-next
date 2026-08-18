# Contract: AI Provider Key Boundary

This contract defines the single chokepoint through which all AI assistant requests pass, and the rule that keeps the AI provider key server-side only. It is the most security-sensitive contract in this feature, because a leak here is a billing-and-abuse incident, not a data-leak incident.

## The boundary in one sentence

**Every AI assistant request from any client (web, desktop, mobile) goes through a Supabase Edge Function that injects the AI provider key. The clients do not call the AI provider directly. The AI provider key never appears in any client-distributed bundle, on any platform, in any form.**

## What the shared package exports

```ts
// packages/shared/ai/index.ts (signature, not implementation)

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
    language: 'ar' | 'en';
    appVersion: string;
    deviceClass: 'desktop' | 'mobile' | 'web';
  };
}

export interface AiResponse {
  /**
   * The full assistant message. Long responses are streamed; the client
   * may receive partial deltas via the streaming variant of this contract.
   */
  content: string;
  /**
   * Token usage, returned so the client can show "you have N tokens left".
   * No provider-specific data.
   */
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function sendAiMessage(
  request: AiRequest,
  options?: { signal?: AbortSignal }
): Promise<AiResponse>;

/**
 * Streaming variant. The server pushes partial deltas; the client
 * accumulates them. The final delta is the same shape as `content`
 * in the non-streaming response.
 */
export function streamAiMessage(
  request: AiRequest,
  options?: { signal?: AbortSignal }
): AsyncIterable<AiResponseDelta>;
```

## What the apps are allowed to do

- Call `sendAiMessage(...)` or `streamAiMessage(...)` from any client.
- Pass the user's message and the device context.
- Cancel the request via `AbortSignal` (e.g., when the user navigates away from the chat).

## What the apps are NOT allowed to do

- ❌ Make any direct call to an AI provider's API — through an SDK (`openai`, `@anthropic-ai/sdk`, etc.), through raw HTTP to the provider's endpoint, or through any other mechanism. All AI traffic goes through the shared package, which calls the Edge Function. This rule applies to **all** client contexts, including the Electron main process, the Electron preload script, the desktop renderer's web context, the mobile JS runtime, and the web app's server-side code paths that don't go through the Edge Function.
- ❌ Send the AI provider key, the user's auth token, or any other secret in a request body or header. The Edge Function reads the AI key from its own environment.
- ❌ Cache the AI response on the device in a way that persists across users on the same device (spec FR-020's spirit: the response may be cached for the same user, but the key must never be reachable).
- ❌ Read or write the AI provider's response stream directly. The shared package's `streamAiMessage` is the only consumer.

## What the Edge Function does

- Receives the `AiRequest`.
- Reads the AI provider key from its own environment.
- Forwards the request to the AI provider.
- Streams the response back to the client.
- Logs the request (with PII redacted) for billing and abuse detection.
- Applies the same rate limits as the existing web app (spec FR-019).

## What happens to a leaked key

If gitleaks or any other scanner finds a string matching a known AI provider key pattern in a built artifact, the build fails and the release is blocked (spec FR-017, SC-005). The key in question is rotated immediately. The rate-limit policy is reviewed for the period between key creation and key detection.

## Testing the contract

- **Unit test (shared package)**: `sendAiMessage` calls the Edge Function URL, not the AI provider URL. (Mock the network; assert on the requested URL.)
- **Build-time test**: gitleaks on every built artifact (Electron asar, Expo bundle, Next.js static export) returns zero matches for known AI provider key patterns. This is the same gate as the Supabase service-role scan; one tool, one config.
- **Runtime test (smoke)**: send a real message from each platform and confirm a real response. This is a release-blocker.
- **Negative test**: a request that includes a header named `x-ai-provider-key` (or any variant) is rejected at the Edge Function. The header is not read; its presence is logged as a possible leak attempt.

## What this contract does NOT cover

- **Which AI provider is used**. The Edge Function can swap providers without changing the client contract.
- **The model version**. The Edge Function picks the model (e.g., GPT-5 nano) based on its own configuration, not the client's.
- **Fine-tuning / custom model deployment**. Out of scope for v1; the Edge Function calls the provider's hosted endpoint.
- **Conversation memory beyond the existing Supabase tables**. The conversation history is in Supabase, not in the AI provider's memory. This is unchanged from the web app.
