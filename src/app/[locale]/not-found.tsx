import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-900 font-sans"
      dir={dir}
    >
      <div className="text-center relative">
        <h1 className="text-9xl font-black text-blue-600/20 dark:text-blue-500/10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
          404
        </h1>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
            {t("title")}
          </h2>
          <p 
            className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed"
            style={{ unicodeBidi: "plaintext" }}
          >
            {t("message")}
          </p>
          <Link
            href={`/${locale}/`}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 transition-all active:scale-95"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
