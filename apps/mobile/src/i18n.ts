/**
 * Mobile i18n - locale resolution + translation lookup.
 *
 * Per spec FR-008 and the edge case "a mobile user has both Arabic and
 * English system languages configured: the app follows the device
 * primary language, with an in-app override":
 *
 *   1. An in-app override persisted in AsyncStorage wins.
 *   2. Otherwise expo-localization's device primary language is used
 *      ("ar" | "en"), defaulting to "ar" to match the web app's
 *      defaultLocale.
 *
 * Messages come from the shared package (spec FR-013 / US3): the JSON
 * namespaces under masarx-shared/messages/{ar,en}/ are THE source of
 * truth - this file adds no strings of its own beyond the tiny
 * MOBILE_STRINGS supplement for mobile-only UI (tab bar labels, offline
 * banner), pending promotion into the shared registry.
 *
 * The lookup signature matches the shared i18n contract
 * (t(locale, namespace, key, values?)); when packages/shared/src/i18n
 * lands with its "./i18n" export, `translateMessage` below can delegate
 * to it without any call-site changes.
 */
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import arCommon from "masarx-shared/messages/ar/common.json";
import arAuth from "masarx-shared/messages/ar/auth.json";
import arAiAssistant from "masarx-shared/messages/ar/aiAssistant.json";
import arProfile from "masarx-shared/messages/ar/profile.json";
import arSubjects from "masarx-shared/messages/ar/subjects.json";
import arSummaries from "masarx-shared/messages/ar/summaries.json";
import arQuizzes from "masarx-shared/messages/ar/quizzes.json";
import arFileDropzone from "masarx-shared/messages/ar/fileDropzone.json";
import enCommon from "masarx-shared/messages/en/common.json";
import enAuth from "masarx-shared/messages/en/auth.json";
import enAiAssistant from "masarx-shared/messages/en/aiAssistant.json";
import enProfile from "masarx-shared/messages/en/profile.json";
import enSubjects from "masarx-shared/messages/en/subjects.json";
import enSummaries from "masarx-shared/messages/en/summaries.json";
import enQuizzes from "masarx-shared/messages/en/quizzes.json";
import enFileDropzone from "masarx-shared/messages/en/fileDropzone.json";

export type Locale = "ar" | "en";
export type Dir = "rtl" | "ltr";
export type MessageValues = Record<string, string | number>;

const LOCALE_OVERRIDE_KEY = "masarx_locale_override";

const REGISTRY: Record<Locale, Record<string, unknown>> = {
  ar: {
    common: arCommon,
    auth: arAuth,
    aiAssistant: arAiAssistant,
    profile: arProfile,
    subjects: arSubjects,
    summaries: arSummaries,
    quizzes: arQuizzes,
    fileDropzone: arFileDropzone,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    aiAssistant: enAiAssistant,
    profile: enProfile,
    subjects: enSubjects,
    summaries: enSummaries,
    quizzes: enQuizzes,
    fileDropzone: enFileDropzone,
  },
};

/**
 * Mobile-only strings (tab bar, offline banner, upload toasts). These
 * have no shared-namespace counterpart yet; they are kept here so the
 * shared JSON remains web-owned. Promote into
 * packages/shared/src/messages/{ar,en}/mobileApp.json when the web team
 * picks them up (contract: "Rules for adding a new key").
 */
export const MOBILE_STRINGS: Record<Locale, Record<string, string>> = {
  ar: {
    "tabs.subjects": "المواد",
    "tabs.summaries": "الملخصات",
    "tabs.quizzes": "الاختبارات",
    "tabs.ai": "المساعد الذكي",
    "tabs.profile": "حسابي",
    "offline.banner": "غير متصل - يتم عرض نسخة محفوظة",
    "offline.aiQueued": "غير متصل. سيتم إرسال الرسالة عند عودة الاتصال.",
    "offline.retryWhenOnline": "تعذر الاتصال. تحقق من الشبكة وحاول مجدداً.",
    "upload.pickPdf": "رفع ملف PDF",
    "upload.picking": "جارٍ فتح المنتقي...",
    "upload.reading": "جارٍ قراءة الملف...",
    "upload.uploading": "جارٍ رفع الملف...",
    "upload.finalizing": "جارٍ إنشاء الرابط...",
    "upload.done": "تم رفع الملف بنجاح",
    "upload.tooLarge": "الملف أكبر من الحد المسموح (50 ميغابايت)",
    "upload.notPdf": "يرجى اختيار ملف PDF فقط",
    "upload.failed": "فشل رفع الملف",
    "upload.needAuth": "سجّل الدخول قبل رفع الملفات",
    "profile.signOut": "تسجيل الخروج",
    "profile.signOutConfirmTitle": "تسجيل الخروج",
    "profile.signOutConfirmMessage": "هل تريد تسجيل الخروج من هذا الجهاز؟",
    "profile.language": "اللغة",
    "profile.languageArabic": "العربية",
    "profile.languageEnglish": "English",
    "profile.restartRequiredTitle": "إعادة التشغيل مطلوبة",
    "profile.restartRequiredMessage":
      "تغيير اتجاه الواجهة (من اليمين لليسار/من اليسار لليمين) يتطلب إعادة تشغيل التطبيق.",
    "profile.appVersion": "إصدار التطبيق",
    "profile.anonymousUser": "مستخدم",
    "login.invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "login.networkError": "تعذر الاتصال بـ Masar X. تحقق من الشبكة وحاول مجدداً.",
    "login.googleDeferred": "تسجيل الدخول عبر Google قادم في تحديث قادم.",
    "quiz.guestMode": "وضع الزائر",
    "quiz.savingOffline": "سيتم حفظ النتيجة محلياً على هذا الجهاز فقط.",
    "common.retry": "إعادة المحاولة",
    "common.offline": "غير متصل",
  },
  en: {
    "tabs.subjects": "Subjects",
    "tabs.summaries": "Summaries",
    "tabs.quizzes": "Quizzes",
    "tabs.ai": "AI Tutor",
    "tabs.profile": "Profile",
    "offline.banner": "Offline - showing saved version",
    "offline.aiQueued": "Offline. Your message will be sent when back online.",
    "offline.retryWhenOnline": "Could not reach Masar X. Check your connection and retry.",
    "upload.pickPdf": "Upload PDF",
    "upload.picking": "Opening picker...",
    "upload.reading": "Reading file...",
    "upload.uploading": "Uploading...",
    "upload.finalizing": "Creating link...",
    "upload.done": "File uploaded successfully",
    "upload.tooLarge": "File exceeds the 50MB limit",
    "upload.notPdf": "Please pick a PDF file",
    "upload.failed": "Upload failed",
    "upload.needAuth": "Sign in before uploading files",
    "profile.signOut": "Sign out",
    "profile.signOutConfirmTitle": "Sign out",
    "profile.signOutConfirmMessage": "Sign out of Masar X on this device?",
    "profile.language": "Language",
    "profile.languageArabic": "العربية",
    "profile.languageEnglish": "English",
    "profile.restartRequiredTitle": "Restart required",
    "profile.restartRequiredMessage":
      "Changing the layout direction (RTL/LTR) requires restarting the app.",
    "profile.appVersion": "App version",
    "profile.anonymousUser": "User",
    "login.invalidCredentials": "Incorrect email or password",
    "login.networkError": "Could not reach Masar X. Check your connection and retry.",
    "login.googleDeferred": "Google sign-in is coming in a future update.",
    "quiz.guestMode": "Guest mode",
    "quiz.savingOffline": "Your result will be saved on this device only.",
    "common.retry": "Retry",
    "common.offline": "Offline",
  },
};

/** Device primary language, normalized to the locales the product ships. */
export function getDeviceLocale(): Locale {
  const locales = Localization.getLocales?.() ?? [];
  const languageCode = locales[0]?.languageCode;
  return languageCode === "en" ? "en" : "ar";
}

export async function getLocaleOverride(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_OVERRIDE_KEY);
    return stored === "ar" || stored === "en" ? stored : null;
  } catch {
    return null;
  }
}

export async function setLocaleOverride(locale: Locale | null): Promise<void> {
  try {
    if (locale) {
      await AsyncStorage.setItem(LOCALE_OVERRIDE_KEY, locale);
    } else {
      await AsyncStorage.removeItem(LOCALE_OVERRIDE_KEY);
    }
  } catch {
    // Best-effort persistence; the UI stays on the previous locale.
  }
}

/** Override wins over the device language (spec edge case, default "ar"). */
export async function resolveLocale(): Promise<Locale> {
  return (await getLocaleOverride()) ?? getDeviceLocale();
}

export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

export function dir(locale: Locale): Dir {
  return isRTL(locale) ? "rtl" : "ltr";
}

function lookup(tree: unknown, path: string): unknown {
  let current: unknown = tree;
  for (const segment of path.split(".")) {
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function interpolate(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Shared-contract translation lookup: t(locale, namespace, key, values?).
 *
 * Resolution order:
 *   1. shared namespace JSON (masarx-shared/messages/{locale}/<ns>.json)
 *   2. mobile-only supplement (MOBILE_STRINGS)
 *   3. the key string itself - the contract's documented fallback for a
 *      key missing from the shared files ("fall back to the key string
 *      itself ... and log a warning in dev mode").
 */
export function translateMessage(
  locale: Locale,
  namespace: string,
  key: string,
  values?: MessageValues,
): string {
  const path = `${namespace}.${key}`;
  const fromShared = lookup(REGISTRY[locale], path);
  if (typeof fromShared === "string") {
    return interpolate(fromShared, values);
  }
  const fromMobile = lookup(MOBILE_STRINGS[locale], path);
  if (typeof fromMobile === "string") {
    return interpolate(fromMobile, values);
  }
  if (__DEV__) {
    console.warn(`[i18n] missing message: ${locale}/${path}`);
  }
  // Opposite-locale rescue before falling back to the raw key, so a
  // late-added key degrades gracefully instead of showing an identifier.
  const other: Locale = locale === "ar" ? "en" : "ar";
  const rescue = lookup(REGISTRY[other], path) ?? lookup(MOBILE_STRINGS[other], path);
  if (typeof rescue === "string") {
    return interpolate(rescue, values);
  }
  return key;
}