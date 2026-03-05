import Link from "next/link";
import { headers } from "next/headers";

export default function NotFound() {
  const acceptLanguage = headers().get("accept-language")?.toLowerCase() || "";
  const localePrefix = acceptLanguage.includes("en") ? "/en" : "/ar";

  return (
    <html lang={acceptLanguage.includes("en") ? "en" : "ar"}>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              404
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              عذراً، الصفحة غير موجودة
            </p>
            <Link
              href={`${localePrefix}/`}
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
