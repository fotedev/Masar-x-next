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

export const cannedMessagesFor = (locale?: string): CannedMessages =>
  (locale || "ar").toLowerCase().startsWith("ar")
    ? arMessages.canned
    : enMessages.canned;
