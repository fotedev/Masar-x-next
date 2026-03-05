"use client";

import { useRedeemAccessCode } from "@/hooks/trw/useTRWHooks";
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

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const { mutate: redeem, isPending } = useRedeemAccessCode();
  const router = useRouter();

  const handleRedeem = () => {
    if (!code.trim()) return;

    redeem(code, {
      onSuccess: (data: any) => {
        if (data.success) {
          toast.success(`تم تفعيل الاشتراك بنجاح في خطة ${data.plan_slug}.`);
          router.push("/non-academic");
        } else {
          let errorMessage = "فشل تفعيل الكود.";
          if (data.error === "invalid_or_expired_code") {
            errorMessage =
              "الكود غير صحيح، منتهي الصلاحية، أو تم استنفد عدد مرات الاستخدام.";
          } else if (data.error === "already_redeemed") {
            errorMessage = "لقد قمت بتفعيل هذا الكود مسبقاً.";
          } else if (data.error === "not_authenticated") {
            errorMessage = "يجب تسجيل الدخول أولاً.";
          }
          toast.error(errorMessage);
        }
      },
      onError: (error: any) => {
        toast.error(error.message || "حدث خطأ ما أثناء الاتصال.");
      },
    });
  };

  return (
    <div className="container max-w-lg py-12" dir="rtl">
      <Card className="border-slate-200 dark:border-white/10 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-600/10 rounded-full w-fit">
            <Ticket className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">تفعيل كود الوصول</CardTitle>
          <CardDescription>
            أدخل كود الوصول الخاص بك أدناه لفتح المحتوى المميز.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="أدخل الكود (مثال: TRW-XXXX-XXXX)"
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
                جاري التفعيل...
              </>
            ) : (
              "تفعيل الوصول"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
