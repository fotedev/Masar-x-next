/**
 * Auto-generated i18n key types for the Masar X monorepo.
 *
 * This file is the build-time contract defined in
 * `specs/004-multi-platform-expansion/contracts/i18n-messages.md`:
 *
 *   "The `types.ts` file is auto-generated from the JSON files. It exports
 *    a type that, for each key, requires both `ar` and `en` to be present.
 *    **A key without a translation in both languages is a build-time error.**"
 *
 * In v1 the JSON namespaces are loaded dynamically by `apps/web/src/i18n/request.ts`
 * via `import("@masarx-shared/messages/{locale}/{namespace}.json")`. Because
 * the keys inside each JSON are application-data (not type metadata), the
 * type system cannot enumerate them at compile time without a code-generation
 * step. The contract is enforced at the *namespace* level here — every
 * locale must export the same set of namespace files — and at the
 * per-namespace level by parallel hand-edits (see the contract's "Rules for
 * adding a new key" section).
 *
 * The hand-maintained list below is the source of truth for which
 * namespaces exist. If you add a namespace, add it here in the same commit
 * and to both `ar/` and `en/`. The CI guard added in T038
 * (`check-translations.sh`) fails the build if a file in `apps/` declares
 * a local translation directory; this file fails the build (via the
 * `@masarx-shared/messages` `package.json` `exports` map) if a namespace
 * is missing in either locale.
 */
export const MESSAGE_NAMESPACES = [
  "addFile",
  "addSubjectModal",
  "addSummary",
  "addVideo",
  "adminDashboard",
  "aiAssistant",
  "appeals",
  "auth",
  "authPages",
  "common",
  "courseDetail",
  "courses",
  "editSummary",
  "errorBoundary",
  "fileDropzone",
  "footer",
  "header",
  "home",
  "lectureSelect",
  "metadata",
  "mobileNav",
  "nav",
  "news",
  "notFound",
  "notifications",
  "onboarding",
  "privacyDetails",
  "privacyPolicy",
  "profile",
  "pwa",
  "quizAttempts",
  "quizzes",
  "reviews",
  "subjectMetadata",
  "subjectPage",
  "subjects",
  "subjectsTab",
  "summaries",
  "theme",
  "trw",
  "trwRedeem",
] as const;

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number];

export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * A typed loader for one (locale, namespace) pair. The web app uses
 * `import("@masarx-shared/messages/{locale}/{namespace}.json")` directly
 * (with the alias mapping in `apps/web/tsconfig.json`'s `paths`); this
 * type is the contract surface for the loader and the AI tooling that
 * validates the JSON files at PR time.
 */
export type MessageModule = { default: Record<string, unknown> };
export type MessageLoader = () => Promise<MessageModule>;
