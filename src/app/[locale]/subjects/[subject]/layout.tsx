import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: { subject: string; locale: string };
}): Promise<Metadata> {
  const locale =
    params.locale === "en" || params.locale === "ar" ? params.locale : "ar";
  const t = await getTranslations({ locale, namespace: "subjectMetadata" });
  const subjectName = decodeURIComponent(params.subject || "").trim();
  const title = subjectName || t("fallbackTitle");
  const canonicalPath = `/${locale}/subjects/${encodeURIComponent(params.subject || "")}`;

  const description = subjectName
    ? t("descriptionWithSubject", { subject: subjectName })
    : t("descriptionFallback");

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default function SubjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
