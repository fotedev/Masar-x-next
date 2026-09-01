import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

import { readFile } from "fs/promises";
import path from "path";

type Messages = Record<string, unknown>;

type MessageModule = { default: Messages };
type MessageLoader = () => Promise<MessageModule>;

const MESSAGE_LOADERS: Record<string, Record<string, MessageLoader>> = {
  ar: {
    addFile: () => import("masarx-shared/messages/ar/addFile.json"),
    addSubjectModal: () => import("masarx-shared/messages/ar/addSubjectModal.json"),
    addSummary: () => import("masarx-shared/messages/ar/addSummary.json"),
    addVideo: () => import("masarx-shared/messages/ar/addVideo.json"),
    adminDashboard: () => import("masarx-shared/messages/ar/adminDashboard.json"),
    aiAssistant: () => import("masarx-shared/messages/ar/aiAssistant.json"),
    appeals: () => import("masarx-shared/messages/ar/appeals.json"),
    auth: () => import("masarx-shared/messages/ar/auth.json"),
    authPages: () => import("masarx-shared/messages/ar/authPages.json"),
    common: () => import("masarx-shared/messages/ar/common.json"),
    courseDetail: () => import("masarx-shared/messages/ar/courseDetail.json"),
    courses: () => import("masarx-shared/messages/ar/courses.json"),
    downloads: () => import("masarx-shared/messages/ar/downloads.json"),
    editSummary: () => import("masarx-shared/messages/ar/editSummary.json"),
    errorBoundary: () => import("masarx-shared/messages/ar/errorBoundary.json"),
    fileDropzone: () => import("masarx-shared/messages/ar/fileDropzone.json"),
    footer: () => import("masarx-shared/messages/ar/footer.json"),
    header: () => import("masarx-shared/messages/ar/header.json"),
    home: () => import("masarx-shared/messages/ar/home.json"),
    lectureSelect: () => import("masarx-shared/messages/ar/lectureSelect.json"),
    metadata: () => import("masarx-shared/messages/ar/metadata.json"),
    mobileNav: () => import("masarx-shared/messages/ar/mobileNav.json"),
    nav: () => import("masarx-shared/messages/ar/nav.json"),
    news: () => import("masarx-shared/messages/ar/news.json"),
    notFound: () => import("masarx-shared/messages/ar/notFound.json"),
    notifications: () => import("masarx-shared/messages/ar/notifications.json"),
    onboarding: () => import("masarx-shared/messages/ar/onboarding.json"),
    privacyDetails: () => import("masarx-shared/messages/ar/privacyDetails.json"),
    privacyPolicy: () => import("masarx-shared/messages/ar/privacyPolicy.json"),
    profile: () => import("masarx-shared/messages/ar/profile.json"),
    pwa: () => import("masarx-shared/messages/ar/pwa.json"),
    quizAttempts: () => import("masarx-shared/messages/ar/quizAttempts.json"),
    quizzes: () => import("masarx-shared/messages/ar/quizzes.json"),
    reviews: () => import("masarx-shared/messages/ar/reviews.json"),
    subjectMetadata: () => import("masarx-shared/messages/ar/subjectMetadata.json"),
    subjectPage: () => import("masarx-shared/messages/ar/subjectPage.json"),
    subjects: () => import("masarx-shared/messages/ar/subjects.json"),
    subjectsTab: () => import("masarx-shared/messages/ar/subjectsTab.json"),
    summaries: () => import("masarx-shared/messages/ar/summaries.json"),
    theme: () => import("masarx-shared/messages/ar/theme.json"),
    trw: () => import("masarx-shared/messages/ar/trw.json"),
    trwRedeem: () => import("masarx-shared/messages/ar/trwRedeem.json"),
  },
  en: {
    addFile: () => import("masarx-shared/messages/en/addFile.json"),
    addSubjectModal: () => import("masarx-shared/messages/en/addSubjectModal.json"),
    addSummary: () => import("masarx-shared/messages/en/addSummary.json"),
    addVideo: () => import("masarx-shared/messages/en/addVideo.json"),
    adminDashboard: () => import("masarx-shared/messages/en/adminDashboard.json"),
    aiAssistant: () => import("masarx-shared/messages/en/aiAssistant.json"),
    appeals: () => import("masarx-shared/messages/en/appeals.json"),
    auth: () => import("masarx-shared/messages/en/auth.json"),
    authPages: () => import("masarx-shared/messages/en/authPages.json"),
    common: () => import("masarx-shared/messages/en/common.json"),
    courseDetail: () => import("masarx-shared/messages/en/courseDetail.json"),
    courses: () => import("masarx-shared/messages/en/courses.json"),
    downloads: () => import("masarx-shared/messages/en/downloads.json"),
    editSummary: () => import("masarx-shared/messages/en/editSummary.json"),
    errorBoundary: () => import("masarx-shared/messages/en/errorBoundary.json"),
    fileDropzone: () => import("masarx-shared/messages/en/fileDropzone.json"),
    footer: () => import("masarx-shared/messages/en/footer.json"),
    header: () => import("masarx-shared/messages/en/header.json"),
    home: () => import("masarx-shared/messages/en/home.json"),
    lectureSelect: () => import("masarx-shared/messages/en/lectureSelect.json"),
    metadata: () => import("masarx-shared/messages/en/metadata.json"),
    mobileNav: () => import("masarx-shared/messages/en/mobileNav.json"),
    nav: () => import("masarx-shared/messages/en/nav.json"),
    news: () => import("masarx-shared/messages/en/news.json"),
    notFound: () => import("masarx-shared/messages/en/notFound.json"),
    notifications: () => import("masarx-shared/messages/en/notifications.json"),
    onboarding: () => import("masarx-shared/messages/en/onboarding.json"),
    privacyDetails: () => import("masarx-shared/messages/en/privacyDetails.json"),
    privacyPolicy: () => import("masarx-shared/messages/en/privacyPolicy.json"),
    profile: () => import("masarx-shared/messages/en/profile.json"),
    pwa: () => import("masarx-shared/messages/en/pwa.json"),
    quizAttempts: () => import("masarx-shared/messages/en/quizAttempts.json"),
    quizzes: () => import("masarx-shared/messages/en/quizzes.json"),
    reviews: () => import("masarx-shared/messages/en/reviews.json"),
    subjectMetadata: () => import("masarx-shared/messages/en/subjectMetadata.json"),
    subjectPage: () => import("masarx-shared/messages/en/subjectPage.json"),
    subjects: () => import("masarx-shared/messages/en/subjects.json"),
    subjectsTab: () => import("masarx-shared/messages/en/subjectsTab.json"),
    summaries: () => import("masarx-shared/messages/en/summaries.json"),
    theme: () => import("masarx-shared/messages/en/theme.json"),
    trw: () => import("masarx-shared/messages/en/trw.json"),
    trwRedeem: () => import("masarx-shared/messages/en/trwRedeem.json"),
  },
};
const namespaceCache = new Map<string, Messages>();

async function readNamespaceFromDisk(locale: string, namespace: string): Promise<Messages> {
  if (process.env.NEXT_RUNTIME === "edge") return {};

  const possiblePaths = [
    path.join(process.cwd(), "packages", "shared", "src", "messages", locale, `${namespace}.json`),
    path.join(process.cwd(), "..", "..", "packages", "shared", "src", "messages", locale, `${namespace}.json`),
    path.join(process.cwd(), "src", "messages", locale, `${namespace}.json`),
  ];

  for (const filePath of possiblePaths) {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed as Messages;
      }
    } catch {
      // try next
    }
  }

  return {};
}

async function safeImportNamespace(
  locale: string,
  namespace: string,
): Promise<Messages> {
  const cacheKey = `${locale}:${namespace}`;
  if (process.env.NODE_ENV !== "development") {
    const cached = namespaceCache.get(cacheKey);
    if (cached && Object.keys(cached).length > 0) return cached;
  } else {
    try {
      const fromDisk = await readNamespaceFromDisk(locale, namespace);
      if (fromDisk && typeof fromDisk === "object" && Object.keys(fromDisk).length > 0) {
        return fromDisk;
      }
    } catch {
      // fallback to loader
    }
  }

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
