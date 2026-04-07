import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

import { readFile } from "fs/promises";
import path from "path";

type Messages = Record<string, unknown>;

type MessageModule = { default: Messages };
type MessageLoader = () => Promise<MessageModule>;

const MESSAGE_LOADERS: Record<string, Record<string, MessageLoader>> = {
  ar: {
    addFile: () => import("@/messages/ar/addFile.json"),
    addSubjectModal: () => import("@/messages/ar/addSubjectModal.json"),
    addSummary: () => import("@/messages/ar/addSummary.json"),
    addVideo: () => import("@/messages/ar/addVideo.json"),
    adminDashboard: () => import("@/messages/ar/adminDashboard.json"),
    aiAssistant: () => import("@/messages/ar/aiAssistant.json"),
    appeals: () => import("@/messages/ar/appeals.json"),
    auth: () => import("@/messages/ar/auth.json"),
    authPages: () => import("@/messages/ar/authPages.json"),
    common: () => import("@/messages/ar/common.json"),
    courseDetail: () => import("@/messages/ar/courseDetail.json"),
    courses: () => import("@/messages/ar/courses.json"),
    editSummary: () => import("@/messages/ar/editSummary.json"),
    errorBoundary: () => import("@/messages/ar/errorBoundary.json"),
    fileDropzone: () => import("@/messages/ar/fileDropzone.json"),
    footer: () => import("@/messages/ar/footer.json"),
    header: () => import("@/messages/ar/header.json"),
    home: () => import("@/messages/ar/home.json"),
    lectureSelect: () => import("@/messages/ar/lectureSelect.json"),
    metadata: () => import("@/messages/ar/metadata.json"),
    nav: () => import("@/messages/ar/nav.json"),
    news: () => import("@/messages/ar/news.json"),
    notFound: () => import("@/messages/ar/notFound.json"),
    notifications: () => import("@/messages/ar/notifications.json"),
    onboarding: () => import("@/messages/ar/onboarding.json"),
    privacyDetails: () => import("@/messages/ar/privacyDetails.json"),
    privacyPolicy: () => import("@/messages/ar/privacyPolicy.json"),
    profile: () => import("@/messages/ar/profile.json"),
    pwa: () => import("@/messages/ar/pwa.json"),
    quizAttempts: () => import("@/messages/ar/quizAttempts.json"),
    quizzes: () => import("@/messages/ar/quizzes.json"),
    reviews: () => import("@/messages/ar/reviews.json"),
    subjectMetadata: () => import("@/messages/ar/subjectMetadata.json"),
    subjectPage: () => import("@/messages/ar/subjectPage.json"),
    subjects: () => import("@/messages/ar/subjects.json"),
    subjectsTab: () => import("@/messages/ar/subjectsTab.json"),
    summaries: () => import("@/messages/ar/summaries.json"),
    theme: () => import("@/messages/ar/theme.json"),
    trw: () => import("@/messages/ar/trw.json"),
    trwRedeem: () => import("@/messages/ar/trwRedeem.json"),
  },
  en: {
    addFile: () => import("@/messages/en/addFile.json"),
    addSubjectModal: () => import("@/messages/en/addSubjectModal.json"),
    addSummary: () => import("@/messages/en/addSummary.json"),
    addVideo: () => import("@/messages/en/addVideo.json"),
    adminDashboard: () => import("@/messages/en/adminDashboard.json"),
    aiAssistant: () => import("@/messages/en/aiAssistant.json"),
    appeals: () => import("@/messages/en/appeals.json"),
    auth: () => import("@/messages/en/auth.json"),
    authPages: () => import("@/messages/en/authPages.json"),
    common: () => import("@/messages/en/common.json"),
    courseDetail: () => import("@/messages/en/courseDetail.json"),
    courses: () => import("@/messages/en/courses.json"),
    editSummary: () => import("@/messages/en/editSummary.json"),
    errorBoundary: () => import("@/messages/en/errorBoundary.json"),
    fileDropzone: () => import("@/messages/en/fileDropzone.json"),
    footer: () => import("@/messages/en/footer.json"),
    header: () => import("@/messages/en/header.json"),
    home: () => import("@/messages/en/home.json"),
    lectureSelect: () => import("@/messages/en/lectureSelect.json"),
    metadata: () => import("@/messages/en/metadata.json"),
    nav: () => import("@/messages/en/nav.json"),
    news: () => import("@/messages/en/news.json"),
    notFound: () => import("@/messages/en/notFound.json"),
    notifications: () => import("@/messages/en/notifications.json"),
    onboarding: () => import("@/messages/en/onboarding.json"),
    privacyDetails: () => import("@/messages/en/privacyDetails.json"),
    privacyPolicy: () => import("@/messages/en/privacyPolicy.json"),
    profile: () => import("@/messages/en/profile.json"),
    pwa: () => import("@/messages/en/pwa.json"),
    quizAttempts: () => import("@/messages/en/quizAttempts.json"),
    quizzes: () => import("@/messages/en/quizzes.json"),
    reviews: () => import("@/messages/en/reviews.json"),
    subjectMetadata: () => import("@/messages/en/subjectMetadata.json"),
    subjectPage: () => import("@/messages/en/subjectPage.json"),
    subjects: () => import("@/messages/en/subjects.json"),
    subjectsTab: () => import("@/messages/en/subjectsTab.json"),
    summaries: () => import("@/messages/en/summaries.json"),
    theme: () => import("@/messages/en/theme.json"),
    trw: () => import("@/messages/en/trw.json"),
    trwRedeem: () => import("@/messages/en/trwRedeem.json"),
  },
};
const namespaceCache = new Map<string, Messages>();

async function readNamespaceFromDisk(locale: string, namespace: string): Promise<Messages> {
  if (process.env.NEXT_RUNTIME === "edge") return {};

  const filePath = path.join(process.cwd(), "src", "messages", locale, `${namespace}.json`);

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Messages;
  } catch {
    return {};
  }
}

async function safeImportNamespace(
  locale: string,
  namespace: string,
): Promise<Messages> {
  const cacheKey = `${locale}:${namespace}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached && Object.keys(cached).length > 0) return cached;

  try {
    const loader = MESSAGE_LOADERS[locale]?.[namespace];
    if (!loader) throw new Error(`No loader for ${locale}/${namespace}`);

    const mod = await loader();
    const messages = mod.default;

    if (messages && typeof messages === "object" && Object.keys(messages).length > 0) {
      namespaceCache.set(cacheKey, messages);
      return messages;
    }

    throw new Error(`Empty messages for ${locale}/${namespace}`);
  } catch (error) {
    // Fallback: Read the JSON directly from disk (Node runtime only).
    try {
      const fromDisk = await readNamespaceFromDisk(locale, namespace);
      if (fromDisk && typeof fromDisk === "object" && Object.keys(fromDisk).length > 0) {
        namespaceCache.set(cacheKey, fromDisk);
        return fromDisk;
      }
    } catch {
      // ignore
    }

    // Secondary fallback: Try English version of the same namespace
    if (locale !== "en") {
      try {
        const fallback = await safeImportNamespace("en", namespace);
        if (fallback && Object.keys(fallback).length > 0) return fallback;
      } catch {
        // ignore
      }
    }

    return {};
  }
}

export default getRequestConfig(
  async ({ requestLocale }: { requestLocale: Promise<string | undefined> }) => {
    const requested = await requestLocale;
    const locale = (routing.locales as readonly string[]).includes(requested || "")
      ? (requested as Locale)
      : routing.defaultLocale;

    // LOAD ALL NAMESPACES for the locale to prevent stale provider issues during SPA navigation
    const localeLoaders = MESSAGE_LOADERS[locale] || {};
    const allNamespaces = Object.keys(localeLoaders);

    const loaded = await Promise.all(
      allNamespaces.map(async (ns: string) => {
        const msg = await safeImportNamespace(locale, ns);
        return [ns, msg] as const;
      }),
    );

    const messages = Object.fromEntries(loaded) as Record<string, Messages>;

    if (process.env.NODE_ENV === "development") {
      console.log(`[i18n-request] Loaded all ${Object.keys(messages).length} namespaces for locale "${locale}"`);
    }

    return {
      locale,
      messages,
    };
  },
);
