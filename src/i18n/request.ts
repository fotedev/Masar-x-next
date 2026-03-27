import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

import fs from "node:fs/promises";
import path from "node:path";

import { routing } from "@/i18n/routing";

type Messages = Record<string, unknown>;

const namespaceCache = new Map<string, Promise<Messages>>();

async function safeImportNamespace(
  locale: string,
  namespace: string,
): Promise<Messages> {
  const cacheKey = `${locale}:${namespace}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    // 1) Attempt the dynamic import first (works in some Next builds).
    try {
      const mod = await import(`@/messages/${locale}/${namespace}.json`);
      const messages = (mod as { default?: Messages }).default || (mod as Record<string, unknown>);

      // If Next failed to include the JSON module, we typically get `undefined` or an empty object.
      if (messages && typeof messages === "object" && Object.keys(messages).length > 0) {
        console.debug(`[i18n] Loaded ${locale}/${namespace} via dynamic import`);
        return messages;
      }
    } catch (error) {
      console.debug(`[i18n] Dynamic import failed for ${locale}/${namespace}:`, error instanceof Error ? error.message : String(error));
      // Ignore and fall back to fs read.
    }

    // 2) Fallback: read the JSON file directly from disk.
    // This is needed for cases where webpack doesn't include the JSON module for a namespace.
    try {
      const filePath = path.join(
        process.cwd(),
        "src",
        "messages",
        locale,
        `${namespace}.json`,
      );
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Messages;
      if (!parsed || Object.keys(parsed).length === 0) {
        console.warn(`[i18n] Loaded empty messages for ${locale}/${namespace} from disk`);
      } else {
        console.debug(`[i18n] Loaded ${locale}/${namespace} from disk (${Object.keys(parsed).length} keys)`);
      }
      return parsed;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[i18n] CRITICAL: Failed to load ${locale}/${namespace} from disk - messages will be MISSING!`);
      console.error(`[i18n] Error details:`, errorMsg);
      return {};
    }
  })();

  namespaceCache.set(cacheKey, promise);
  return promise;
}

function stripLocalePrefix(pathname: string) {
  const match = pathname.match(/^\/(ar|en)(\/|$)/);
  const prefix = match ? `/${match[1]}` : "";
  return prefix ? pathname.slice(prefix.length) || "/" : pathname || "/";
}

function namespacesForPath(pathname: string): string[] {
  const path = stripLocalePrefix(pathname);

  const namespaces = new Set<string>([
    "common",
    "nav",
    "footer",
    "metadata",
    "header",
    "pwa",
    "notifications",
  ]);

  if (path === "/") {
    namespaces.add("home");
    return Array.from(namespaces);
  }
  if (path === "/privacy") {
    namespaces.add("privacy");
    return Array.from(namespaces);
  }
  if (path === "/privacy-policy") {
    namespaces.add("privacyPolicy");
    return Array.from(namespaces);
  }
  if (path === "/privacy-details") {
    namespaces.add("privacyDetails");
    return Array.from(namespaces);
  }
  if (path === "/faq") {
    namespaces.add("faq");
    return Array.from(namespaces);
  }

  if (path === "/login" || path === "/signup" || path === "/reset-password") {
    namespaces.add("authPages");
    return Array.from(namespaces);
  }

  if (path.startsWith("/ai-assistant")) namespaces.add("aiAssistant");
  if (path.startsWith("/quizzes") || path.startsWith("/quiz-play") || path.startsWith("/quiz-attempts")) namespaces.add("quizzes");
  if (path.startsWith("/subjects")) namespaces.add("subjects");
  if (path.startsWith("/courses")) namespaces.add("courses");
  if (path.startsWith("/profile")) namespaces.add("profile");
  if (path.startsWith("/news")) {
    namespaces.add("news");
    namespaces.add("appeals");
  }

  if (path.startsWith("/add-summary")) {
    namespaces.add("addSummary");
    namespaces.add("onboarding");
  }
  if (path.startsWith("/edit-summary")) {
    namespaces.add("editSummary");
    namespaces.add("onboarding");
  }
  if (path.startsWith("/add-file")) namespaces.add("addFile");
  if (path.startsWith("/add-video")) namespaces.add("addVideo");
 
  if (path.startsWith("/profile")) {
    namespaces.add("auth");
    namespaces.add("onboarding");
  }

  if (path.startsWith("/trw")) namespaces.add("trw");
  if (path.startsWith("/non-academic")) namespaces.add("nonAcademic");
  if (path.startsWith("/admin") || path.startsWith("/admin-dashboard")) namespaces.add("adminDashboard");

  return Array.from(namespaces);
}

export default getRequestConfig(
  async ({ requestLocale }: { requestLocale: Promise<string | undefined> }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested)
      ? requested
      : routing.defaultLocale;

    const pathname = headers().get("x-masarx-pathname") || "/";
    const namespaces = namespacesForPath(pathname);

    const loaded = await Promise.all(
      namespaces.map(async (ns) => [ns, await safeImportNamespace(locale, ns)] as const),
    );

    const messages = Object.fromEntries(loaded) as Record<string, Messages>;

    return {
      locale,
      messages,
    };
  },
);
