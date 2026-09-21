/**
 * Locale-resolved access to the assistant's canned UI messages.
 *
 * `lib/ai/*` are non-React modules, so next-intl's `useTranslations`
 * does not apply here. The ar/en message files are imported statically
 * (resolveJsonModule) and selected by the locale the caller already
 * holds — `generateResponse(options.locale)`. Prompt/model-directed
 * text deliberately stays in code; see prompts.ts.
 */

import arMessages from "masarx-shared/messages/ar/aiAssistant.json";
import enMessages from "masarx-shared/messages/en/aiAssistant.json";

export type CannedMessages = typeof arMessages.canned;

/**
 * Emoji prefixes marking a canned string as an AI-service failure. Canned
 * errors are RESOLVED content (assistant.ts's catch returns them as
 * "successful" responses), so the UI can only recognize them by content —
 * keep every error-flavored `canned` entry in aiAssistant.json starting with
 * one of these (the guard test locks this contract:
 * lib/__tests__/cannedErrorPrefixes.test.ts). Informational canned replies
 * (noPlatformContext, groupRagNoData) deliberately start with plain text.
 */
export const CANNED_ERROR_PREFIXES = ["⚠️", "💳"] as const;

export const cannedMessagesFor = (locale?: string): CannedMessages =>
  (locale || "ar").toLowerCase().startsWith("ar")
    ? arMessages.canned
    : enMessages.canned;
