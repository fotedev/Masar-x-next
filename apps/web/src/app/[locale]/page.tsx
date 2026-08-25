import HomeClient from "@/components/HomeClient";
import { DesktopAppBanner } from "./_components/DesktopAppBanner";

type Props = { params: Promise<{ locale: string }> };

export default async function HomeAliasPage({ params }: Props) {
  const { locale } = await params;
  return (
    <>
      <DesktopAppBanner locale={locale} />
      <HomeClient />
    </>
  );
}
