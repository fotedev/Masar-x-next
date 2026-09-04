/**
 * Masar X shared i18n helper -- Spec 004, Task T040.
 *
 * Contract: specs/004-multi-platform-expansion/contracts/i18n-messages.md.
 * The JSON files under src/messages/{ar,en}/ are the single source of
 * truth for translations; this module is the dependency-free runtime
 * surface over them.
 *
 * Exports:
 *   - messages        locale -> namespace -> strings registry (static JSON
 *                     imports; Metro/webpack/Next all bundle JSON natively)
 *   - t()             dot-path lookup + {placeholder} interpolation, with
 *                     an en fallback when the requested locale misses a
 *                     key, and the key string itself as the last resort
 *   - getNamespaces() sorted namespace names available for a locale
 *   - hasKey()        strict (no-fallback) key existence check
 *
 * Consumers:
 *   - Web + desktop keep loading messages through next-intl from
 *     @masarx-shared/messages/* (unchanged; see apps/web/src/i18n/request.ts).
 *   - Mobile (Expo/Metro) imports this module via the @masarx-shared/i18n
 *     package export and passes the device locale from expo-localization.
 *
 * Dependency-free by design: the only imports are the JSON message files
 * and the generated src/messages/types.ts. Nothing from node_modules, so
 * the module is safe in every runtime (Next.js server + client, Electron
 * main + renderer, React Native).
 */

import type { SupportedLocale } from "../messages/types";
// ---------------------------------------------------------------------------
// Arabic (ar) namespaces -- generated from src/messages/ar/*.json
// ---------------------------------------------------------------------------
import arAddFile from "../messages/ar/addFile.json";
import arAddSubjectModal from "../messages/ar/addSubjectModal.json";
import arAddSummary from "../messages/ar/addSummary.json";
import arAddVideo from "../messages/ar/addVideo.json";
import arAdminDashboard from "../messages/ar/adminDashboard.json";
import arAiAssistant from "../messages/ar/aiAssistant.json";
import arAppeals from "../messages/ar/appeals.json";
import arAuth from "../messages/ar/auth.json";
import arAuthPages from "../messages/ar/authPages.json";
import arCommon from "../messages/ar/common.json";
import arCourseDetail from "../messages/ar/courseDetail.json";
import arCourses from "../messages/ar/courses.json";
import arDownloads from "../messages/ar/downloads.json";
import arEditSummary from "../messages/ar/editSummary.json";
import arErrorBoundary from "../messages/ar/errorBoundary.json";
import arFileDropzone from "../messages/ar/fileDropzone.json";
import arFooter from "../messages/ar/footer.json";
import arHeader from "../messages/ar/header.json";
import arHome from "../messages/ar/home.json";
import arLectureSelect from "../messages/ar/lectureSelect.json";
import arMetadata from "../messages/ar/metadata.json";
import arMobileNav from "../messages/ar/mobileNav.json";
import arNav from "../messages/ar/nav.json";
import arNews from "../messages/ar/news.json";
import arNotFound from "../messages/ar/notFound.json";
import arNotifications from "../messages/ar/notifications.json";
import arOnboarding from "../messages/ar/onboarding.json";
import arPrivacyDetails from "../messages/ar/privacyDetails.json";
import arPrivacyPolicy from "../messages/ar/privacyPolicy.json";
import arProfile from "../messages/ar/profile.json";
import arPwa from "../messages/ar/pwa.json";
import arQuizAttempts from "../messages/ar/quizAttempts.json";
import arQuizzes from "../messages/ar/quizzes.json";
import arReviews from "../messages/ar/reviews.json";
import arSubjectMetadata from "../messages/ar/subjectMetadata.json";
import arSubjectPage from "../messages/ar/subjectPage.json";
import arSubjects from "../messages/ar/subjects.json";
import arSubjectsTab from "../messages/ar/subjectsTab.json";
import arSummaries from "../messages/ar/summaries.json";
import arTheme from "../messages/ar/theme.json";
import arTrw from "../messages/ar/trw.json";
import arTrwRedeem from "../messages/ar/trwRedeem.json";

// ---------------------------------------------------------------------------
// English (en) namespaces -- generated from src/messages/en/*.json
// ---------------------------------------------------------------------------
import enAddFile from "../messages/en/addFile.json";
import enAddSubjectModal from "../messages/en/addSubjectModal.json";
import enAddSummary from "../messages/en/addSummary.json";
import enAddVideo from "../messages/en/addVideo.json";
import enAdminDashboard from "../messages/en/adminDashboard.json";
import enAiAssistant from "../messages/en/aiAssistant.json";
import enAppeals from "../messages/en/appeals.json";
import enAuth from "../messages/en/auth.json";
import enAuthPages from "../messages/en/authPages.json";
import enCommon from "../messages/en/common.json";
import enCourseDetail from "../messages/en/courseDetail.json";
import enCourses from "../messages/en/courses.json";
import enDownloads from "../messages/en/downloads.json";
import enEditSummary from "../messages/en/editSummary.json";
import enErrorBoundary from "../messages/en/errorBoundary.json";
import enFileDropzone from "../messages/en/fileDropzone.json";
import enFooter from "../messages/en/footer.json";
import enHeader from "../messages/en/header.json";
import enHome from "../messages/en/home.json";
import enLectureSelect from "../messages/en/lectureSelect.json";
import enMetadata from "../messages/en/metadata.json";
import enMobileNav from "../messages/en/mobileNav.json";
import enNav from "../messages/en/nav.json";
import enNews from "../messages/en/news.json";
import enNotFound from "../messages/en/notFound.json";
import enNotifications from "../messages/en/notifications.json";
import enOnboarding from "../messages/en/onboarding.json";
import enPrivacyDetails from "../messages/en/privacyDetails.json";
import enPrivacyPolicy from "../messages/en/privacyPolicy.json";
import enProfile from "../messages/en/profile.json";
import enPwa from "../messages/en/pwa.json";
import enQuizAttempts from "../messages/en/quizAttempts.json";
import enQuizzes from "../messages/en/quizzes.json";
import enReviews from "../messages/en/reviews.json";
import enSubjectMetadata from "../messages/en/subjectMetadata.json";
import enSubjectPage from "../messages/en/subjectPage.json";
import enSubjects from "../messages/en/subjects.json";
import enSubjectsTab from "../messages/en/subjectsTab.json";
import enSummaries from "../messages/en/summaries.json";
import enTheme from "../messages/en/theme.json";
import enTrw from "../messages/en/trw.json";
import enTrwRedeem from "../messages/en/trwRedeem.json";
/**
 * Arabic registry. I18nNamespace below is derived from the ar/ JSON
 * directory: adding a namespace means adding ar/<name>.json + its import +
 * its entry here in the same commit (the en parity guard fails the build
 * otherwise).
 */
const arMessages = {
  addFile: arAddFile,
  addSubjectModal: arAddSubjectModal,
  addSummary: arAddSummary,
  addVideo: arAddVideo,
  adminDashboard: arAdminDashboard,
  aiAssistant: arAiAssistant,
  appeals: arAppeals,
  auth: arAuth,
  authPages: arAuthPages,
  common: arCommon,
  courseDetail: arCourseDetail,
  courses: arCourses,
  downloads: arDownloads,
  editSummary: arEditSummary,
  errorBoundary: arErrorBoundary,
  fileDropzone: arFileDropzone,
  footer: arFooter,
  header: arHeader,
  home: arHome,
  lectureSelect: arLectureSelect,
  metadata: arMetadata,
  mobileNav: arMobileNav,
  nav: arNav,
  news: arNews,
  notFound: arNotFound,
  notifications: arNotifications,
  onboarding: arOnboarding,
  privacyDetails: arPrivacyDetails,
  privacyPolicy: arPrivacyPolicy,
  profile: arProfile,
  pwa: arPwa,
  quizAttempts: arQuizAttempts,
  quizzes: arQuizzes,
  reviews: arReviews,
  subjectMetadata: arSubjectMetadata,
  subjectPage: arSubjectPage,
  subjects: arSubjects,
  subjectsTab: arSubjectsTab,
  summaries: arSummaries,
  theme: arTheme,
  trw: arTrw,
  trwRedeem: arTrwRedeem,
};

/**
 * Namespace names present in the shared registry, derived from the JSON
 * files on disk. Note: currently a superset of MESSAGE_NAMESPACES in
 * src/messages/types.ts (that hand-maintained list does not include
 * "downloads" yet).
 */
export type I18nNamespace = keyof typeof arMessages;

/**
 * English registry. Typed against I18nNamespace so a namespace that exists
 * in only one locale fails to compile right here (missing key -> TS2741,
 * extra key -> TS2353). This is the namespace-level parity guard described
 * in src/messages/types.ts; the per-key contract (every key in both ar and
 * en) is enforced at PR time per i18n-messages.md.
 */
const enMessages: Record<I18nNamespace, unknown> = {
  addFile: enAddFile,
  addSubjectModal: enAddSubjectModal,
  addSummary: enAddSummary,
  addVideo: enAddVideo,
  adminDashboard: enAdminDashboard,
  aiAssistant: enAiAssistant,
  appeals: enAppeals,
  auth: enAuth,
  authPages: enAuthPages,
  common: enCommon,
  courseDetail: enCourseDetail,
  courses: enCourses,
  downloads: enDownloads,
  editSummary: enEditSummary,
  errorBoundary: enErrorBoundary,
  fileDropzone: enFileDropzone,
  footer: enFooter,
  header: enHeader,
  home: enHome,
  lectureSelect: enLectureSelect,
  metadata: enMetadata,
  mobileNav: enMobileNav,
  nav: enNav,
  news: enNews,
  notFound: enNotFound,
  notifications: enNotifications,
  onboarding: enOnboarding,
  privacyDetails: enPrivacyDetails,
  privacyPolicy: enPrivacyPolicy,
  profile: enProfile,
  pwa: enPwa,
  quizAttempts: enQuizAttempts,
  quizzes: enQuizzes,
  reviews: enReviews,
  subjectMetadata: enSubjectMetadata,
  subjectPage: enSubjectPage,
  subjects: enSubjects,
  subjectsTab: enSubjectsTab,
  summaries: enSummaries,
  theme: enTheme,
  trw: enTrw,
  trwRedeem: enTrwRedeem,
};

/**
 * The full message registry: locale -> namespace -> strings (flat keys).
 * Leaves are normally strings; lookup() tolerates nested objects for
 * forward compatibility, but t() only ever returns string leaves.
 */
export const messages = {
  ar: arMessages,
  en: enMessages,
};

/** Type of the exported messages registry. */
export type MessagesRegistry = typeof messages;

/** Locale used as fallback when a key is missing in the requested locale. */
export const DEFAULT_LOCALE: SupportedLocale = "en";

/** Values for {placeholder} interpolation in message strings. */
export type TranslationValues = Record<string, string | number>;
/**
 * Translate one key.
 *
 * Resolution order:
 *   1. messages[locale][namespace] via dot-path lookup;
 *   2. en fallback when the key is missing in the requested locale and
 *      the requested locale is not en already;
 *   3. the key string itself (never undefined, never throws).
 *
 * Missing keys warn via console.warn in development builds only
 * (process.env.NODE_ENV !== "production"; silent in production for every
 * runtime).
 *
 * @example
 *   t("ar", "auth", "signIn");                    // Arabic sign-in label
 *   t("en", "common", "pageOf", { current: 2, total: 5 });
 */
export function t(
  locale: SupportedLocale,
  namespace: I18nNamespace,
  key: string,
  values?: TranslationValues,
): string {
  const resolved = resolveMessage(locale, namespace, key);
  if (typeof resolved !== "string") {
    warnMissing(locale, namespace, key);
    return key;
  }
  return interpolate(resolved, values, locale, namespace, key);
}

/**
 * Namespace names available for `locale`, sorted alphabetically. Both
 * locales expose the same set (enforced by the enMessages parity guard).
 */
export function getNamespaces(locale: SupportedLocale): I18nNamespace[] {
  return (Object.keys(messages[locale]) as I18nNamespace[]).sort();
}

/**
 * Whether `key` exists in `locale`/`namespace`. Strict: checks the given
 * locale only, with no en fallback -- use
 * `hasKey(locale, ns, key) || hasKey(DEFAULT_LOCALE, ns, key)` to probe
 * t()'s fallback resolution. Never warns.
 */
export function hasKey(
  locale: SupportedLocale,
  namespace: I18nNamespace,
  key: string,
): boolean {
  return lookup(messages[locale][namespace], key) !== undefined;
}
// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

/**
 * Resolve one key inside a namespace table:
 *   1. exact flat key (the v1 contract format is flat JSON, e.g.
 *      "signIn"; also covers a fully-dotted key stored verbatim);
 *   2. nested dot-path walk (e.g. "form.email" -> table.form.email).
 * Prototype-chain names ("constructor", "__proto__", ...) never resolve:
 * every step uses Object.prototype.hasOwnProperty.
 */
function lookup(table: unknown, key: string): unknown {
  if (typeof table !== "object" || table === null) {
    return undefined;
  }
  const record = table as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }
  let current: unknown = record;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    const currentRecord = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(currentRecord, segment)) {
      return undefined;
    }
    current = currentRecord[segment];
  }
  return current;
}

/** Resolve a key for a locale, falling back to en when allowed. */
function resolveMessage(
  locale: SupportedLocale,
  namespace: I18nNamespace,
  key: string,
): unknown {
  const direct = lookup(messages[locale][namespace], key);
  if (direct !== undefined) {
    return direct;
  }
  if (locale !== DEFAULT_LOCALE) {
    return lookup(messages[DEFAULT_LOCALE][namespace], key);
  }
  return undefined;
}

/** Replace {name} placeholders; unknown placeholders are left intact. */
function interpolate(
  template: string,
  values: TranslationValues | undefined,
  locale: SupportedLocale,
  namespace: I18nNamespace,
  key: string,
): string {
  if (values === undefined || !template.includes("{")) {
    return template;
  }
  const vals = values;
  return template.replace(
    PLACEHOLDER_PATTERN,
    (match: string, name: string): string => {
      const trimmed = name.trim();
      if (Object.prototype.hasOwnProperty.call(vals, trimmed)) {
        return String(vals[trimmed]);
      }
      warnDev(
        `[masarx-shared/i18n] Missing interpolation value "{${trimmed}}" ` +
          `for ${locale}.${namespace}.${key}; leaving the placeholder as-is.`,
      );
      return match;
    },
  );
}

/** Dev-only console.warn. Silent in production builds of every runtime. */
function warnDev(message: string): void {
  if (isDev()) {
    console.warn(message);
  }
}

function isDev(): boolean {
  // Next.js (web/desktop) and Expo/Metro (mobile) both define
  // process.env.NODE_ENV; the typeof guard keeps runtimes without a
  // process global safe.
  return (
    typeof process !== "undefined" &&
    process.env !== undefined &&
    process.env.NODE_ENV !== "production"
  );
}

function warnMissing(
  locale: SupportedLocale,
  namespace: I18nNamespace,
  key: string,
): void {
  warnDev(
    `[masarx-shared/i18n] Missing message for ${locale}.${namespace}."${key}" ` +
      `(en fallback exhausted); returning the key string.`,
  );
}
