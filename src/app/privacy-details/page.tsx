import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

function detectFromHeader(acceptLanguage: string | null): "ar" | "en" | null {
  if (!acceptLanguage) return null;

  const value = acceptLanguage.toLowerCase();

  if (value.includes("ar")) return "ar";
  if (value.includes("en")) return "en";

  return null;
}

export default function PrivacyDetailsRedirectPage() {
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  const acceptLanguage = headers().get("accept-language");
  const detected = detectFromHeader(acceptLanguage);
  const locale =
    (cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : null) ??
    detected ??
    "ar";

  redirect(`/${locale}/privacy-details`);
}
