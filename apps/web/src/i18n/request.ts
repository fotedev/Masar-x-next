import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

// Spec 033 Track D (audit MID-3): fs/path are NOT statically imported.
// A static import made the file tracer pull the whole project (public/,
// coverage/, src/) into the standalone output — the build's "filesystem
// access causes the whole project to be traced" warning. The disk read is
// dev-only (HMR of message JSON), so the modules load dynamically inside
// readNamespaceFromDisk and the prod catch-fallback disk read is gone
// (prod loader failures fall through to the English fallback below).

type Messages = Record<string, unknown>;

type MessageModule = { default: Messages };
type MessageLoader = () => Promise<MessageModule>;

const MESSAGE_LOADERS: Record<string, Record<string, MessageLoader>> = {
  ar: {
    addFile: () => import("masarx-shared/messages/ar/addFile.json"),
    addSubjectModal: () => import("masarx-shared/messages/ar/addSubjectModal.json"),
    addVideo: () => import("masarx-shared/messages/ar/addVideo.json"),
    adminDashboard: () => import("masarx-shared/messages/ar/adminDashboard.json"),
    aiAssistant: () => import("masarx-shared/messages/ar/aiAssistant.json"),
    appeals: () => import("masarx-shared/messages/ar/appeals.json"),
    auth: () => import("masarx-shared/messages/ar/auth.json"),
    authPages: () => import("masarx-shared/messages/ar/authPages.json"),
    common: () => import("masarx-shared/messages/ar/common.json"),
    courseDetail: () => import("masarx-shared/messages/ar/courseDetail.json"),
    courses: () => import("masarx-shared/messages/ar/courses.json"),
    desktopStudyWorkspace: () =>
      import("masarx-shared/messages/ar/desktopStudyWorkspace.json"),
    desktopUpdates: () => import("masarx-shared/messages/ar/desktopUpdates.json"),
    downloads: () => import("masarx-shared/messages/ar/downloads.json"),
    editSummary: () => import("masarx-shared/messages/ar/editSummary.json"),
    enrollments: () => import("masarx-shared/messages/ar/enrollments.json"),
    errorBoundary: () => import("masarx-shared/messages/ar/errorBoundary.json"),
    faq: () => import("masarx-shared/messages/ar/faq.json"),
    fileDropzone: () => import("masarx-shared/messages/ar/fileDropzone.json"),
    footer: () => import("masarx-shared/messages/ar/footer.json"),
    header: () => import("masarx-shared/messages/ar/header.json"),
    home: () => import("masarx-shared/messages/ar/home.json"),
    lectureSelect: () => import("masarx-shared/messages/ar/lectureSelect.json"),
    metadata: () => import("masarx-shared/messages/ar/metadata.json"),
    mobileNav: () => import("masarx-shared/messages/ar/mobileNav.json"),
    nav: () => import("masarx-shared/messages/ar/nav.json"),
    materials: () => import("masarx-shared/messages/ar/materials.json"),
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
    schedules: () => import("masarx-shared/messages/ar/schedules.json"),
    subjects: () => import("masarx-shared/messages/ar/subjects.json"),
    subjectsTab: () => import("masarx-shared/messages/ar/subjectsTab.json"),
    summaries: () => import("masarx-shared/messages/ar/summaries.json"),
    theme: () => import("masarx-shared/messages/ar/theme.json"),
    titlebar: () => import("masarx-shared/messages/ar/titlebar.json"),
    trwRedeem: () => import("masarx-shared/messages/ar/trwRedeem.json"),
    waitlist: () => import("masarx-shared/messages/ar/waitlist.json"),
  },
  en: {
    addFile: () => import("masarx-shared/messages/en/addFile.json"),
    addSubjectModal: () => import("masarx-shared/messages/en/addSubjectModal.json"),
    addVideo: () => import("masarx-shared/messages/en/addVideo.json"),
    adminDashboard: () => import("masarx-shared/messages/en/adminDashboard.json"),
    aiAssistant: () => import("masarx-shared/messages/en/aiAssistant.json"),
    appeals: () => import("masarx-shared/messages/en/appeals.json"),
    auth: () => import("masarx-shared/messages/en/auth.json"),
    authPages: () => import("masarx-shared/messages/en/authPages.json"),
    common: () => import("masarx-shared/messages/en/common.json"),
    courseDetail: () => import("masarx-shared/messages/en/courseDetail.json"),
    courses: () => import("masarx-shared/messages/en/courses.json"),
    desktopStudyWorkspace: () =>
      import("masarx-shared/messages/en/desktopStudyWorkspace.json"),
    desktopUpdates: () => import("masarx-shared/messages/en/desktopUpdates.json"),
    downloads: () => import("masarx-shared/messages/en/downloads.json"),
    editSummary: () => import("masarx-shared/messages/en/editSummary.json"),
    enrollments: () => import("masarx-shared/messages/en/enrollments.json"),
    errorBoundary: () => import("masarx-shared/messages/en/errorBoundary.json"),
    faq: () => import("masarx-shared/messages/en/faq.json"),
    fileDropzone: () => import("masarx-shared/messages/en/fileDropzone.json"),
    footer: () => import("masarx-shared/messages/en/footer.json"),
    header: () => import("masarx-shared/messages/en/header.json"),
    home: () => import("masarx-shared/messages/en/home.json"),
    lectureSelect: () => import("masarx-shared/messages/en/lectureSelect.json"),
    metadata: () => import("masarx-shared/messages/en/metadata.json"),
    mobileNav: () => import("masarx-shared/messages/en/mobileNav.json"),
    nav: () => import("masarx-shared/messages/en/nav.json"),
    materials: () => import("masarx-shared/messages/en/materials.json"),
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
    schedules: () => import("masarx-shared/messages/en/schedules.json"),
    subjects: () => import("masarx-shared/messages/en/subjects.json"),
    subjectsTab: () => import("masarx-shared/messages/en/subjectsTab.json"),
    summaries: () => import("masarx-shared/messages/en/summaries.json"),
    theme: () => import("masarx-shared/messages/en/theme.json"),
    titlebar: () => import("masarx-shared/messages/en/titlebar.json"),
    trwRedeem: () => import("masarx-shared/messages/en/trwRedeem.json"),
    waitlist: () => import("masarx-shared/messages/en/waitlist.json"),
  },
};
const namespaceCache = new Map<string, Messages>();

async function readNamespaceFromDisk(locale: string, namespace: string): Promise<Messages> {
  if (process.env.NEXT_RUNTIME === "edge") return {};

  // Dynamic imports keep fs/path out of the production module graph
  // (see the import-block note above).
  const { readFile } = await import("fs/promises");
  const { default: path } = await import("path");

  const possiblePaths = [
    path.join(process.cwd(), "packages", "shared", "src", "messages", locale, `${namespace}.json`),
    path.join(process.cwd(), "..", "..", "packages", "shared", "src", "messages", locale, `${namespace}.json`),
    path.join(process.cwd(), "src", "messages", locale, `${namespace}.json`),
  ];

  for (const filePath of possiblePaths) {
    try {
      // turbopackIgnore: true — this dev-only read must not make the
      // tracer pull the whole project into the standalone output.
      const raw = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
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
  } catch {
    // Spec 033 Track D: the former prod disk-read fallback is removed —
    // bundled static imports of JSON cannot realistically fail, and the
    // unresolvable fs access dragged the whole project into the traced
    // standalone output. Loader failures fall through to the English
    // fallback below.

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
