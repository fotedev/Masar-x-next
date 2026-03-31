import { redirect } from "next/navigation";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function HomeAliasPage({ params }: Props) {
  const { locale } = await params;

  if (locale === "en") {
    redirect("/en");
  }

  redirect("/");
}
