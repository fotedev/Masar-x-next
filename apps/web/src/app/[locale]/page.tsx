import HomeClient from "@/components/HomeClient";
import { DesktopAppBanner } from "./_components/DesktopAppBanner";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function HomeAliasPage({ params }: Props) {
  const { locale } = await params;
  return (
    <div className="space-y-6 sm:space-y-8">
      <DesktopAppBanner locale={locale} />
      <HomeClient />
    </div>
  );
}
