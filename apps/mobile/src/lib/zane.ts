import { supabase, SITE_URL } from "./supabase";
import type { AiRequest, AiResponse } from "@masarx-shared/ai";

// Cross-platform AI contract (specs/004/contracts/ai-boundary.md):
// every AI request goes through the Supabase Edge Function `ai-chat`,
// which injects the provider key server-side. The app calls the Edge
// Function directly with the user's access token — the same trust
// boundary the web app reaches through its /api/ai-chat proxy.
export const APP_VERSION = "1.2.0";

export type ZaneMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function newConversationId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `mbl-${Date.now()}-${rnd}`;
}

export async function sendZaneMessage(
  userMessage: string,
  conversationId: string,
): Promise<{ content: string | null; error: string | null }> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return { content: null, error: "انتهت الجلسة — سجّل الدخول مرة أخرى" };

  const body: AiRequest = {
    conversationId,
    userMessage,
    context: { language: "ar", appVersion: APP_VERSION, deviceClass: "mobile" },
  };

  let response: Response;
  try {
    response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { content: null, error: "تعذّر الاتصال بالمساعد — تحقق من اتصالك بالإنترنت" };
  }

  if (response.status === 401) {
    return { content: null, error: "انتهت الجلسة — سجّل الدخول مرة أخرى" };
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const wait = retryAfter ? ` بعد ${retryAfter} ثانية` : " قليلًا";
    return { content: null, error: `وصلت إلى حد الاستخدام — حاول${wait}` };
  }
  if (!response.ok) {
    return { content: null, error: "تعذّر الحصول على رد من المساعد، حاول مجددًا" };
  }

  const data = (await response.json()) as AiResponse;
  return { content: data?.content ?? "", error: null };
}

export { SITE_URL };
