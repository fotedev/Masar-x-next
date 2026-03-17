"use client";

import useRedeemAccessCode from "@/hooks/trw/useRedeemAccessCode";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/hooks/useToast";
import { Loader2, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

type RedeemResponse = {
  success: boolean;
  plan_slug?: string;
  error?: string;
};

const getErrorMessage = (err: unknown): string | null => {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === "string" ? msg : null;
  }
  return null;
};

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const { mutate: redeem, isPending } = useRedeemAccessCode();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("trwRedeem");

  const handleRedeem = () => {
    if (!code.trim()) return;

    redeem(code, {
      onSuccess: (data: RedeemResponse) => {
        if (data.success) {
          toast.success(t("success", { plan: data.plan_slug || "" }));
          router.push(`/${locale}/non-academic`);
        } else {
          let errorMessage = t("failed");
          if (data.error === "invalid_or_expired_code") {
            errorMessage = t("invalidOrExpired");
          } else if (data.error === "already_redeemed") {
            errorMessage = t("alreadyRedeemed");
          } else if (data.error === "not_authenticated") {
            errorMessage = t("notAuthenticated");
          }
          toast.error(errorMessage);
        }
      },
      onError: (error: unknown) => {
        toast.error(getErrorMessage(error) || t("connectionError"));
      },
    });
  };

  return (
    <div
      className="container max-w-lg py-12"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <Card className="border-slate-200 dark:border-white/10 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-600/10 rounded-full w-fit">
            <Ticket className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder={t("placeholder")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isPending}
              className="text-center font-mono text-lg tracking-widest bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
            />
          </div>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
            onClick={handleRedeem}
            disabled={isPending || !code.trim()}
          >
            {isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
