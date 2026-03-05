import { redirect } from "next/navigation";

type Props = {
  params: { locale: string };
};

export default function HomeAliasPage({ params }: Props) {
  const locale = params.locale;

  if (locale === "en") {
    redirect("/en");
  }

  redirect("/");
}
