import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Locale = "ar" | "en";

export default function QuizAttemptsRedirectPage() {
  const requestLocale = headers().get("x-next-intl-locale");
  const locale: Locale =
    requestLocale === "en" || requestLocale === "ar" ? requestLocale : "ar";

  redirect(`/${locale}/quiz-attempts`);
}
