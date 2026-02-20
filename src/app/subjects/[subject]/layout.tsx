import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { subject: string };
}): Promise<Metadata> {
  const subjectName = decodeURIComponent(params.subject || "").trim();
  const title = subjectName || "المادة";
  const canonicalPath = `/subjects/${encodeURIComponent(params.subject || "")}`;

  const description = subjectName
    ? `ملخصات، محاضرات، ملفات، وفيديوهات لمادة ${subjectName} على منصة Masar X.`
    : "ملخصات ومحاضرات ومواد تعليمية على منصة Masar X.";

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
