import { toast } from "sonner";

type ConfirmToastOptions = {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function confirmToast(
  message: string,
  options: ConfirmToastOptions = {},
): Promise<boolean> {
  const {
    description,
    confirmLabel = "تأكيد",
    cancelLabel = "إلغاء",
  } = options;

  const isDanger =
    (confirmLabel || "").includes("حذف") || (message || "").includes("حذف");

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    toast(message, {
      description,
      duration: Infinity,
      className:
        "!rounded-2xl !border !shadow-xl !backdrop-blur !bg-white/95 dark:!bg-slate-950/95 !text-slate-900 dark:!text-white " +
        (isDanger
          ? "!border-red-200 dark:!border-red-900/50"
          : "!border-brand-blue/20 dark:!border-brand-blue/30"),
      descriptionClassName: "!text-xs !font-bold !text-slate-500 dark:!text-slate-400",
      action: {
        label: confirmLabel,
        onClick: () => settle(true),
      },
      cancel: {
        label: cancelLabel,
        onClick: () => settle(false),
      },
      actionButtonStyle: {
        background: isDanger ? "#dc2626" : "#3b82f6",
        color: "#ffffff",
        fontWeight: 800,
        borderRadius: "12px",
      },
      cancelButtonStyle: {
        background: "#e2e8f0",
        color: "#0f172a",
        fontWeight: 800,
        borderRadius: "12px",
      },
      onDismiss: () => settle(false),
    });
  });
}
