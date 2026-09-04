import Link from "next/link";
import { headers, cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import arMessages from "masarx-shared/messages/ar/notFound.json";
import enMessages from "masarx-shared/messages/en/notFound.json";

type Locale = "en" | "ar";

async function getDetectedLocale(): Promise<Locale> {
  const headersList = await headers();
  const requestLocale = headersList.get("x-next-intl-locale");
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const acceptLanguage = headersList.get("accept-language")?.toLowerCase() || "";

  if (requestLocale === "en" || requestLocale === "ar") return requestLocale as Locale;
  if (cookieLocale === "en" || cookieLocale === "ar") return cookieLocale as Locale;
  
  try {
    const intlLocale = await getLocale();
    if (intlLocale === "en" || intlLocale === "ar") return intlLocale as Locale;
  } catch {
    // Fallback to headers
  }

  return acceptLanguage.includes("en") ? "en" : "ar";
}

export async function generateMetadata() {
  const locale = await getDetectedLocale();
  const messages = locale === "ar" ? arMessages : enMessages;
  return {
    title: messages.pageTitle,
  };
}

export default async function NotFound() {
  const locale = await getDetectedLocale();
  const messages = locale === "ar" ? arMessages : enMessages;
  const t = messages;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div 
      className="min-h-dvh-safe flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-900 font-sans"
      dir={dir}
    >
      <div className="text-center relative">
        <h1 className="text-9xl font-black text-blue-600/20 dark:text-blue-500/10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
          404
        </h1>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
            {t.title}
          </h2>
          <p 
            className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed"
            style={{ unicodeBidi: "plaintext" }}
          >
            {t.message}
          </p>
          <Link
            href={`/${locale}/`}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 transition-all active:scale-95"
          >
            {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
