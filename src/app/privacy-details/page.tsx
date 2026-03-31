import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

function detectFromHeader(acceptLanguage: string | null): "ar" | "en" | null {
  if (!acceptLanguage) return null;

  const value = acceptLanguage.toLowerCase();

  if (value.includes("ar")) return "ar";
  if (value.includes("en")) return "en";

  return null;
}

export default async function PrivacyDetailsRedirectPage() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const acceptLanguage = headersList.get("accept-language");
  const detected = detectFromHeader(acceptLanguage);
  const locale =
    (cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : null) ??
    detected ??
    "ar";

  redirect(`/${locale}/privacy-details`);
}
