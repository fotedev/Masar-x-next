import { redirect } from "next/navigation";

type Props = {
  params: {
    locale: string;
  };
};

export default function AdminCompatibilityRedirectPage({ params }: Props) {
  redirect(`/${params.locale}/admin-dashboard`);
}
