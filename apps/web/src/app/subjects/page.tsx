import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function SubjectsRedirectPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    (cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : null) ??
    "ar";

  redirect(`/${locale}/subjects`);
}
