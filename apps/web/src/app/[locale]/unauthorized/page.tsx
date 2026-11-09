import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * Rendered when a signed-in, non-admin user reaches an admin surface
 * (review 2026-11-07: the `/unauthorized` target previously did not exist
 * and 404'd).
 */
export default async function UnauthorizedPage() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        {t("unauthorizedTitle")}
      </h1>
      <p className="max-w-md text-gray-600 dark:text-gray-300">
        {t("unauthorizedMessage")}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-orange/90"
      >
        {t("backToHome")}
      </Link>
    </div>
  );
}
