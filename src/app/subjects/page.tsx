import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function SubjectsRedirectPage() {
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  const locale =
    (cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : null) ??
    "ar";

  redirect(`/${locale}/subjects`);
}
