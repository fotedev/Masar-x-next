import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Locale = "ar" | "en";

export default async function QuizAttemptsRedirectPage() {
  const headersList = await headers();
  const requestLocale = headersList.get("x-next-intl-locale");
  const locale: Locale =
    requestLocale === "en" || requestLocale === "ar" ? requestLocale : "ar";

  redirect(`/${locale}/quiz-attempts`);
}
