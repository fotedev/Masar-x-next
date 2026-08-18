import { type ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string; locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, subject: rawSubject } = await params;
  const locale =
    rawLocale === "en" || rawLocale === "ar" ? rawLocale : "ar";
  const t = await getTranslations({ locale, namespace: "subjectMetadata" });
  const subjectName = decodeURIComponent(rawSubject || "").trim();
  const title = subjectName || t("fallbackTitle");
  const canonicalPath = `/${locale}/subjects/${encodeURIComponent(rawSubject || "")}`;

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
  children: ReactNode;
}) {
  return children;
}
