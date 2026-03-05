import Link from "next/link";
import { headers } from "next/headers";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export default function NotFound() {
  const headersList = headers();
  const acceptLanguage =
    headersList.get("accept-language")?.toLowerCase() || "";
  const requestLocale = headersList.get("x-next-intl-locale");

  const locale =
    requestLocale === "en" || acceptLanguage.includes("en") ? "en" : "ar";

  const messages = locale === "en" ? en : ar;
  const t = messages.notFound;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <head>
        <title>{t.pageTitle}</title>
      </head>
      <body className="bg-gray-50 dark:bg-slate-900 font-sans">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-9xl font-black text-blue-600/20 dark:text-blue-500/10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
              404
            </h1>
            <div className="relative z-10">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                {t.title}
              </h2>
              <p className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
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
      </body>
    </html>
  );
}
