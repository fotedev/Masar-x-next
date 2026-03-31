import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { routing, type Locale } from "@/i18n/routing";

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
      const loader = MESSAGE_LOADERS[locale]?.[namespace];
      if (!loader) throw new Error(`No loader for ${locale}/${namespace}`);
      
      if (process.env.NODE_ENV === "development") {
        console.debug(`[i18n] Loading ${locale}/${namespace}...`);
      }

      const mod = await loader();
      const messages = mod.default;

      if (messages && typeof messages === "object" && Object.keys(messages).length > 0) {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[i18n] Successfully loaded ${locale}/${namespace} (${Object.keys(messages).length} keys)`);
        }
        return messages;
      }
      throw new Error(`Empty messages for ${locale}/${namespace}`);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] Dynamic import failed for ${locale}/${namespace}:`, error instanceof Error ? error.message : String(error));
      }
    }

    // 2) Fallback: read the JSON file directly from disk.
    // This is needed for cases where webpack doesn't include the JSON module for a namespace.
    try {
      throw new Error("Message loader not available");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[i18n] CRITICAL: Failed to load ${locale}/${namespace} - messages will be MISSING!`);
      console.error(`[i18n] Error details:`, errorMsg);

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
  })();

  namespaceCache.set(cacheKey, promise);
  return promise;
}

function stripLocalePrefix(pathname: string) {
  const locales = (routing.locales as readonly string[]).join("|");
  const regex = new RegExp(`^\\/(${locales})(\\/|$)`);
  const match = pathname.match(regex);
  const prefix = match ? `/${match[1]}` : "";
  let stripped = prefix ? pathname.slice(prefix.length) || "/" : pathname || "/";
  // Ensure the path always starts with / and doesn't have duplicate slashes
  stripped = stripped.startsWith("/") ? stripped : `/${stripped}`;
  
  // Normalized path for matching (e.g., /ar/news -> /news, /ar -> /)
  const normalized = stripped === "/" ? stripped : stripped.replace(/\/+$/, "");
  return normalized;
}

function safePathnameFromHeaderValue(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return null;

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).pathname;
    }
  } catch {
    // ignore
  }

  if (trimmed.startsWith("/")) return trimmed;

  try {
    return new URL(`http://local${trimmed.startsWith("/") ? "" : "/"}${trimmed}`).pathname;
  } catch {
    return null;
  }
}

function resolvePathnameFromHeaders(headersList: Headers): string | null {
  const candidates = [
    headersList.get("x-pathname"),
    headersList.get("next-url"),
    headersList.get("x-next-url"),
    headersList.get("x-invoke-path"),
    headersList.get("x-original-url"),
  ];

  for (const candidate of candidates) {
    const pathname = safePathnameFromHeaderValue(candidate);
    if (pathname) return pathname;
  }

  const referer = headersList.get("referer");
  const refererPath = safePathnameFromHeaderValue(referer);
  if (refererPath) return refererPath;

  return null;
}

const STATIC_PATH_NAMESPACES: Record<string, string[]> = {
  "/": ["home"],
  "/privacy": ["common"],
  "/privacy-policy": ["privacyPolicy"],
  "/privacy-details": ["privacyDetails"],
  "/login": ["authPages", "auth"],
  "/signup": ["authPages", "auth"],
  "/reset-password": ["authPages", "auth"],
  "/news": ["news", "appeals"],
  "/subjects": ["subjects", "subjectsTab", "appeals"],
  "/courses": ["courses"],
};

const PREFIX_PATH_NAMESPACES: Array<{ prefix: string; namespaces: string[] }> = [
  { prefix: "/ai-assistant", namespaces: ["aiAssistant"] },
  { prefix: "/quizzes", namespaces: ["quizzes"] },
  { prefix: "/quiz-play", namespaces: ["quizzes"] },
  { prefix: "/quiz-attempts", namespaces: ["quizzes"] },
  { prefix: "/courses", namespaces: ["courses"] },
  { prefix: "/news", namespaces: ["news", "appeals"] },
  { prefix: "/subjects", namespaces: ["subjectPage", "subjects", "subjectsTab", "appeals", "subjectMetadata"] },
  { prefix: "/profile", namespaces: ["profile", "auth", "onboarding", "appeals"] },
  { prefix: "/summaries", namespaces: ["subjects", "appeals"] },
  { prefix: "/add-summary", namespaces: ["addSummary", "onboarding", "subjects"] },
  { prefix: "/edit-summary", namespaces: ["editSummary", "onboarding", "subjects"] },
  { prefix: "/add-file", namespaces: ["addFile", "subjects"] },
  { prefix: "/add-video", namespaces: ["addVideo", "subjects"] },
  { prefix: "/trw", namespaces: ["trw", "trwRedeem"] },
  { prefix: "/admin", namespaces: ["adminDashboard", "news", "subjects", "courses", "quizzes"] },
  { prefix: "/admin-dashboard", namespaces: ["adminDashboard", "news", "subjects", "courses", "quizzes"] },
];

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
    "notFound",
  ]);

  // Handle news and appeals which are globally used in modals or shared sections
  if (path.includes("/news") || path === "/") {
    namespaces.add("news");
    namespaces.add("appeals");
  }

    // Handle subjects, summaries, and courses
    if (path.includes("/subjects") || path.includes("/summaries") || path.includes("/courses")) {
      ["subjectPage", "subjects", "subjectsTab", "summaries", "subjectMetadata", "appeals", "courses", "courseDetail"].forEach((ns) => namespaces.add(ns));
    }

  // Handle quizzes
  if (path.includes("/quizzes") || path.includes("/quiz-play") || path.includes("/quiz-attempts") || path.includes("/admin")) {
    ["quizzes", "trw", "trwRedeem", "onboarding"].forEach((ns) => namespaces.add(ns));
  }

  // Handle auth and profile
  if (path.includes("/login") || path.includes("/signup") || path.includes("/profile") || path.includes("/reset-password")) {
    ["auth", "authPages", "profile", "onboarding"].forEach((ns) => namespaces.add(ns));
  }

  // Handle home specific
  if (path === "/" || path === "") {
    namespaces.add("home");
    namespaces.add("subjects"); // Home page uses SubjectsGrid
    namespaces.add("subjectsTab");
    namespaces.add("summaries");
  }

  // Handle exact matches
  if (STATIC_PATH_NAMESPACES[path]) {
    STATIC_PATH_NAMESPACES[path].forEach((ns) => namespaces.add(ns));
  }

  // Handle prefix matches
  for (const item of PREFIX_PATH_NAMESPACES) {
    if (path === item.prefix || path.startsWith(item.prefix + "/")) {
      item.namespaces.forEach((ns) => namespaces.add(ns));
    }
  }

  return Array.from(namespaces);
}

export default getRequestConfig(
  async ({ requestLocale }: { requestLocale: Promise<string | undefined> }) => {
    const requested = await requestLocale;
    const locale = (routing.locales as readonly string[]).includes(requested || "")
      ? (requested as Locale)
      : routing.defaultLocale;

    const headersList = await headers();
    let pathname = resolvePathnameFromHeaders(headersList) ?? "/";

    const namespaces = namespacesForPath(pathname || "/");
    // Only log in development to keep production logs clean
    if (process.env.NODE_ENV === "development") {
      console.info(`[i18n] Path: "${pathname}", Resolved namespaces: ${namespaces.join(", ")}`);
    }

    const loaded = await Promise.all(
      namespaces.map(async (ns) => [ns, await safeImportNamespace(locale, ns)] as const),
    );

    const messages = Object.fromEntries(loaded) as Record<string, Messages>;

    // FINAL ROBUST CHECK: Ensure specific routes have their essential namespaces.
    // This catches cases where path detection is slightly off but the route is clear.
    const normalizedPath = stripLocalePrefix(pathname || "/");
    const forceLoad = async (ns: string) => {
      if (!messages[ns]) {
        messages[ns] = await safeImportNamespace(locale, ns);
      }
    };

    if (normalizedPath.includes("/courses")) {
      await forceLoad("courses");
      await forceLoad("courseDetail");
      await forceLoad("subjects");
    } else if (normalizedPath.includes("/subjects") || normalizedPath.includes("/summaries")) {
      await forceLoad("subjects");
      await forceLoad("subjectPage");
    } else if (normalizedPath.includes("/quizzes") || normalizedPath.includes("/quiz-play") || normalizedPath.includes("/quiz-attempts")) {
      await forceLoad("quizzes");
      await forceLoad("onboarding");
    } else if (normalizedPath === "/") {
      await forceLoad("home");
    }

    return {
      locale,
      messages,
    };
  },
);
